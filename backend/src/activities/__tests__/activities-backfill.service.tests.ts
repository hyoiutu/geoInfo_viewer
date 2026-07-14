// biome-ignore-all lint/style/useNamingConvention: Strava APIレスポンス形式(snake_case)に合わせたテストダブル
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { StravaActivitiesService } from '../../strava/strava-activities.service';
import { StravaRateLimiterService } from '../../strava/strava-rate-limiter.service';
import type { StravaActivity, StravaActivityDetail } from '../../strava/types/strava-activity.type';
import { ActivitiesBackfillService } from '../activities-backfill.service';
import { CyclingActivityEntity } from '../entities/cycling-activity.entity';

const createActivity = (overrides: Partial<StravaActivity>): StravaActivity => ({
  id: 1,
  name: 'テストライド',
  type: 'Ride',
  distance: 1000,
  moving_time: 600,
  elapsed_time: 650,
  total_elevation_gain: 50,
  start_date: '2026-07-01T00:00:00Z',
  map: { summary_polyline: '' },
  ...overrides
});

const createActivityDetail = (overrides: Partial<StravaActivityDetail>): StravaActivityDetail => ({
  id: 1,
  name: 'テストライド',
  type: 'Ride',
  distance: 1000,
  moving_time: 600,
  elapsed_time: 650,
  total_elevation_gain: 50,
  start_date: '2026-07-01T00:00:00Z',
  map: { summary_polyline: '', polyline: '' },
  ...overrides
});

// runBackfillはfire-and-forgetの非同期処理のため、内部のawait連鎖が完了するまでイベントループを回す
const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

// TypeORMのIsNull()/Not(IsNull())はFindOperatorインスタンス(.typeで種別を判別可能)になる。
// 呼び出し「順番」ではなくクエリの中身（引数の形）に応じて結果を返すことで、
// 「何回目の呼び出しか」を数えるコメントを書かずに済むようにする。
type FindOperatorLike = { type?: string };

describe('ActivitiesBackfillServiceに関するテスト', () => {
  let fetchAllCyclingActivities: ReturnType<typeof vi.fn>;
  let fetchCyclingActivityDetail: ReturnType<typeof vi.fn>;
  let getIntervalMs: ReturnType<typeof vi.fn>;
  let cyclingActivityRepository: {
    find: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    createQueryBuilder: ReturnType<typeof vi.fn>;
  };
  let queryBuilderExecute: ReturnType<typeof vi.fn>;
  let queryBuilderSet: ReturnType<typeof vi.fn>;

  // find()はfetchAndSavePlaceholders内の既存ID確認（引数無し）と、
  // runBackfill内の未取得分取得（where: detailFetchedAt IsNull）の2種類の呼ばれ方をする。
  const mockCyclingActivityFind = (params: {
    existingEntities: CyclingActivityEntity[];
    pendingEntities: CyclingActivityEntity[];
  }) => {
    cyclingActivityRepository.find.mockImplementation((options?: { where?: unknown }) =>
      Promise.resolve(options === undefined ? params.existingEntities : params.pendingEntities)
    );
  };

  // count()はisFullyBackfilled/getStatus内で、引数無し(totalCount)・
  // where: detailFetchedAt IsNull(pendingCount)・where: detailFetchedAt Not(IsNull())(completedCount)
  // の3種類の呼ばれ方をする。呼び出し回数に関わらず正しい値を返す。
  const mockCyclingActivityCounts = (params: { totalCount: number; pendingCount: number }) => {
    const completedCount = params.totalCount - params.pendingCount;
    cyclingActivityRepository.count.mockImplementation(
      (options?: { where?: { detailFetchedAt?: FindOperatorLike } }) => {
        const operatorType = options?.where?.detailFetchedAt?.type;
        if (operatorType === undefined) {
          return Promise.resolve(params.totalCount);
        }
        return Promise.resolve(operatorType === 'isNull' ? params.pendingCount : completedCount);
      }
    );
  };

  const createService = async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ActivitiesBackfillService,
        { provide: StravaActivitiesService, useValue: { fetchAllCyclingActivities, fetchCyclingActivityDetail } },
        { provide: StravaRateLimiterService, useValue: { getIntervalMs } },
        { provide: getRepositoryToken(CyclingActivityEntity), useValue: cyclingActivityRepository }
      ]
    }).compile();

    return moduleRef.get(ActivitiesBackfillService);
  };

  beforeEach(() => {
    fetchAllCyclingActivities = vi.fn().mockResolvedValue([]);
    fetchCyclingActivityDetail = vi.fn().mockResolvedValue(createActivityDetail({}));
    getIntervalMs = vi.fn().mockReturnValue(9000);
    queryBuilderExecute = vi.fn().mockResolvedValue(undefined);
    queryBuilderSet = vi.fn().mockReturnValue({ execute: queryBuilderExecute });
    cyclingActivityRepository = {
      find: vi.fn().mockResolvedValue([]),
      save: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
      createQueryBuilder: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({ set: queryBuilderSet })
      })
    };
  });

  describe('isRunning', () => {
    test('start前はfalseを返す', async () => {
      const service = await createService();

      expect(service.isRunning()).toBe(false);
    });
  });

  describe('start', () => {
    test('未実行の場合、started:trueを返しisRunningがtrueになる', async () => {
      // 意図的に解決しないPromiseでジョブを実行中のまま保持し、タイミング競合を避ける
      fetchAllCyclingActivities.mockReturnValue(new Promise(() => {}));
      const service = await createService();

      const result = await service.start();

      expect(result).toEqual({ started: true });
      expect(service.isRunning()).toBe(true);
    });

    test('既に実行中の場合、started:falseを返す（二重起動しない）', async () => {
      fetchAllCyclingActivities.mockReturnValue(new Promise(() => {}));
      const service = await createService();
      await service.start();

      const result = await service.start();

      expect(result).toEqual({ started: false });
    });

    test('一覧取得したアクティビティのうちDB未登録のものだけプレースホルダーとして保存する', async () => {
      fetchAllCyclingActivities.mockResolvedValue([createActivity({ id: 1 }), createActivity({ id: 2 })]);
      cyclingActivityRepository.find.mockResolvedValue([
        Object.assign(new CyclingActivityEntity(), { id: '1', detailFetchedAt: null })
      ]);
      const service = await createService();

      await service.start();
      await flushMicrotasks();

      expect(cyclingActivityRepository.save).toHaveBeenCalledWith([
        expect.objectContaining({ id: '2', path: null, detailFetchedAt: null })
      ]);
    });

    test('detailFetchedAtがnullの行それぞれについて詳細APIを呼び出し、Entityを更新保存する', async () => {
      mockCyclingActivityFind({
        existingEntities: [],
        pendingEntities: [
          Object.assign(new CyclingActivityEntity(), { id: '1', detailFetchedAt: null }),
          Object.assign(new CyclingActivityEntity(), { id: '2', detailFetchedAt: null })
        ]
      });
      fetchCyclingActivityDetail.mockImplementation((id: number) => Promise.resolve(createActivityDetail({ id })));
      const service = await createService();

      await service.start();
      await flushMicrotasks();

      expect(fetchCyclingActivityDetail).toHaveBeenCalledWith(1);
      expect(fetchCyclingActivityDetail).toHaveBeenCalledWith(2);
      expect(cyclingActivityRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: '1', detailFetchedAt: expect.any(Date) })
      );
      expect(cyclingActivityRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: '2', detailFetchedAt: expect.any(Date) })
      );
    });

    test('既に全件バックフィル済み（未取得行が無い）の場合、Stravaへの一覧再取得を行わず即座に完了する', async () => {
      mockCyclingActivityCounts({ totalCount: 629, pendingCount: 0 });
      const service = await createService();

      await service.start();
      await flushMicrotasks();

      expect(fetchAllCyclingActivities).not.toHaveBeenCalled();
      expect(service.isRunning()).toBe(false);
    });

    test('完了後にisRunningがfalseに戻る', async () => {
      const service = await createService();

      await service.start();
      await flushMicrotasks();

      expect(service.isRunning()).toBe(false);
    });

    test('途中でエラーが発生してもisRunningがfalseに戻る（次回start可能）', async () => {
      fetchAllCyclingActivities.mockRejectedValue(new Error('Strava API error'));
      const service = await createService();

      await service.start();
      await flushMicrotasks();

      expect(service.isRunning()).toBe(false);
    });

    test('途中でエラーが発生した場合、getStatus()のlastErrorに記録される', async () => {
      fetchAllCyclingActivities.mockRejectedValue(new Error('Strava API error'));
      const service = await createService();

      await service.start();
      await flushMicrotasks();
      const status = await service.getStatus();

      expect(status.lastError).toEqual(
        expect.objectContaining({ errorCode: 'INTERNAL_ERROR', message: 'Strava API error' })
      );
    });

    test('前回エラーが記録されていても、再度startすればlastErrorがリセットされる', async () => {
      fetchAllCyclingActivities.mockRejectedValueOnce(new Error('Strava API error'));
      const service = await createService();
      await service.start();
      await flushMicrotasks();

      await service.start();
      await flushMicrotasks();
      const status = await service.getStatus();

      expect(status.lastError).toBeNull();
    });

    test('詳細API取得中にエラーが発生した場合、それ以降の未取得アクティビティの処理を中断する', async () => {
      mockCyclingActivityFind({
        existingEntities: [],
        pendingEntities: [
          Object.assign(new CyclingActivityEntity(), { id: '1', detailFetchedAt: null }),
          Object.assign(new CyclingActivityEntity(), { id: '2', detailFetchedAt: null }),
          Object.assign(new CyclingActivityEntity(), { id: '3', detailFetchedAt: null })
        ]
      });
      fetchCyclingActivityDetail.mockImplementation((id: number) => {
        if (id === 2) {
          return Promise.reject(new Error('Strava API error'));
        }
        return Promise.resolve(createActivityDetail({ id }));
      });
      const service = await createService();

      await service.start();
      await flushMicrotasks();

      expect(fetchCyclingActivityDetail).toHaveBeenCalledWith(1);
      expect(fetchCyclingActivityDetail).toHaveBeenCalledWith(2);
      expect(fetchCyclingActivityDetail).not.toHaveBeenCalledWith(3);
      expect(service.isRunning()).toBe(false);
    });

    test('エラー発生後に再度startすると、未処理のまま残ったアクティビティ(DB上でdetailFetchedAtがnullのもの)のみを取得する', async () => {
      // id:1は既に取得済み(detailFetchedAt設定済み)、id:2・3が前回のエラーで未取得のまま残っている状況を想定
      mockCyclingActivityFind({
        existingEntities: [],
        pendingEntities: [
          Object.assign(new CyclingActivityEntity(), { id: '2', detailFetchedAt: null }),
          Object.assign(new CyclingActivityEntity(), { id: '3', detailFetchedAt: null })
        ]
      });
      fetchCyclingActivityDetail.mockImplementation((id: number) => Promise.resolve(createActivityDetail({ id })));
      const service = await createService();

      await service.start();
      await flushMicrotasks();

      expect(fetchCyclingActivityDetail).toHaveBeenCalledWith(2);
      expect(fetchCyclingActivityDetail).toHaveBeenCalledWith(3);
      expect(fetchCyclingActivityDetail).not.toHaveBeenCalledWith(1);
    });
  });

  describe('startForceRefetch', () => {
    test('未実行の場合、started:trueを返しisRunningがtrueになる', async () => {
      fetchCyclingActivityDetail.mockReturnValue(new Promise(() => {}));
      cyclingActivityRepository.find.mockResolvedValue([
        Object.assign(new CyclingActivityEntity(), { id: '1', detailFetchedAt: null })
      ]);
      const service = await createService();

      const result = await service.startForceRefetch();

      expect(result).toEqual({ started: true });
      expect(service.isRunning()).toBe(true);
    });

    test('既にバックフィル(start)が実行中の場合、started:falseを返す（isRunningガードを共有する）', async () => {
      fetchAllCyclingActivities.mockReturnValue(new Promise(() => {}));
      const service = await createService();
      await service.start();

      const result = await service.startForceRefetch();

      expect(result).toEqual({ started: false });
    });

    test('既にstartForceRefetchが実行中の場合、startはstarted:falseを返す（isRunningガードを共有する）', async () => {
      fetchCyclingActivityDetail.mockReturnValue(new Promise(() => {}));
      cyclingActivityRepository.find.mockResolvedValue([
        Object.assign(new CyclingActivityEntity(), { id: '1', detailFetchedAt: null })
      ]);
      const service = await createService();
      await service.startForceRefetch();

      const result = await service.start();

      expect(result).toEqual({ started: false });
    });

    test('全アクティビティのdetailFetchedAtをnullにリセットしてから、詳細を再取得する', async () => {
      cyclingActivityRepository.find.mockResolvedValue([
        Object.assign(new CyclingActivityEntity(), { id: '1', detailFetchedAt: null }),
        Object.assign(new CyclingActivityEntity(), { id: '2', detailFetchedAt: null })
      ]);
      fetchCyclingActivityDetail.mockImplementation((id: number) => Promise.resolve(createActivityDetail({ id })));
      const service = await createService();

      await service.startForceRefetch();
      await flushMicrotasks();

      expect(queryBuilderSet).toHaveBeenCalledWith({ detailFetchedAt: null });
      expect(queryBuilderExecute).toHaveBeenCalled();
      expect(fetchAllCyclingActivities).not.toHaveBeenCalled();
      expect(fetchCyclingActivityDetail).toHaveBeenCalledWith(1);
      expect(fetchCyclingActivityDetail).toHaveBeenCalledWith(2);
    });

    test('完了後にisRunningがfalseに戻る', async () => {
      const service = await createService();

      await service.startForceRefetch();
      await flushMicrotasks();

      expect(service.isRunning()).toBe(false);
    });

    test('詳細API取得中にエラーが発生した場合、getStatus()のlastErrorに記録される', async () => {
      cyclingActivityRepository.find.mockResolvedValue([
        Object.assign(new CyclingActivityEntity(), { id: '1', detailFetchedAt: null })
      ]);
      fetchCyclingActivityDetail.mockRejectedValue(new Error('Strava API error'));
      const service = await createService();

      await service.startForceRefetch();
      await flushMicrotasks();
      const status = await service.getStatus();

      expect(status.lastError).toEqual(
        expect.objectContaining({ errorCode: 'INTERNAL_ERROR', message: 'Strava API error' })
      );
    });
  });

  describe('getStatus', () => {
    test('全件数・完了件数から進捗率(%)を計算する', async () => {
      mockCyclingActivityCounts({ totalCount: 4, pendingCount: 3 });
      const service = await createService();

      const status = await service.getStatus();

      expect(status).toEqual(
        expect.objectContaining({ isRunning: false, totalCount: 4, completedCount: 1, progressPercent: 25 })
      );
    });

    test('全件数が0の場合、進捗率は0を返す（0除算しない）', async () => {
      mockCyclingActivityCounts({ totalCount: 0, pendingCount: 0 });
      const service = await createService();

      const status = await service.getStatus();

      expect(status.progressPercent).toBe(0);
    });

    test('実行中でない場合、estimatedRemainingSecondsはnullを返す', async () => {
      mockCyclingActivityCounts({ totalCount: 4, pendingCount: 3 });
      const service = await createService();

      const status = await service.getStatus();

      expect(status.estimatedRemainingSeconds).toBeNull();
    });

    test('エラーが発生していない場合、lastErrorはnullを返す', async () => {
      const service = await createService();

      const status = await service.getStatus();

      expect(status.lastError).toBeNull();
    });

    test('実行中の場合、残件数とレート制限間隔から残り秒数を見積もる', async () => {
      // 意図的に解決しないPromiseでジョブを実行中のまま保持し、タイミング競合を避ける
      fetchAllCyclingActivities.mockReturnValue(new Promise(() => {}));
      mockCyclingActivityCounts({ totalCount: 4, pendingCount: 3 });
      const service = await createService();
      await service.start();

      const status = await service.getStatus();

      expect(status.isRunning).toBe(true);
      expect(status.estimatedRemainingSeconds).toBe(((4 - 1) * 9000) / 1000);
    });
  });
});
