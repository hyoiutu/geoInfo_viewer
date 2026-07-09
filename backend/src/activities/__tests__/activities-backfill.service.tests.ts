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
  start_date: '2026-07-01T00:00:00Z',
  map: { summary_polyline: '', polyline: '' },
  ...overrides
});

// runBackfillはfire-and-forgetの非同期処理のため、内部のawait連鎖が完了するまでイベントループを回す
const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('ActivitiesBackfillServiceに関するテスト', () => {
  let fetchAllCyclingActivities: ReturnType<typeof vi.fn>;
  let fetchCyclingActivityDetail: ReturnType<typeof vi.fn>;
  let getIntervalMs: ReturnType<typeof vi.fn>;
  let cyclingActivityRepository: {
    find: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
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
    cyclingActivityRepository = {
      find: vi.fn().mockResolvedValue([]),
      save: vi.fn(),
      count: vi.fn().mockResolvedValue(0)
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
        Object.assign(new CyclingActivityEntity(), { id: 1, detailFetchedAt: null })
      ]);
      const service = await createService();

      await service.start();
      await flushMicrotasks();

      expect(cyclingActivityRepository.save).toHaveBeenCalledWith([
        expect.objectContaining({ id: 2, path: null, detailFetchedAt: null })
      ]);
    });

    test('detailFetchedAtがnullの行それぞれについて詳細APIを呼び出し、Entityを更新保存する', async () => {
      cyclingActivityRepository.find
        .mockResolvedValueOnce([]) // 既存ID確認用
        .mockResolvedValueOnce([
          Object.assign(new CyclingActivityEntity(), { id: 1, detailFetchedAt: null }),
          Object.assign(new CyclingActivityEntity(), { id: 2, detailFetchedAt: null })
        ]); // 未取得分の取得
      fetchCyclingActivityDetail.mockImplementation((id: number) => Promise.resolve(createActivityDetail({ id })));
      const service = await createService();

      await service.start();
      await flushMicrotasks();

      expect(fetchCyclingActivityDetail).toHaveBeenCalledWith(1);
      expect(fetchCyclingActivityDetail).toHaveBeenCalledWith(2);
      expect(cyclingActivityRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, detailFetchedAt: expect.any(Date) })
      );
      expect(cyclingActivityRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 2, detailFetchedAt: expect.any(Date) })
      );
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
  });

  describe('getStatus', () => {
    test('全件数・完了件数から進捗率(%)を計算する', async () => {
      cyclingActivityRepository.count.mockResolvedValueOnce(4).mockResolvedValueOnce(1);
      const service = await createService();

      const status = await service.getStatus();

      expect(status).toEqual(
        expect.objectContaining({ isRunning: false, totalCount: 4, completedCount: 1, progressPercent: 25 })
      );
    });

    test('全件数が0の場合、進捗率は0を返す（0除算しない）', async () => {
      cyclingActivityRepository.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
      const service = await createService();

      const status = await service.getStatus();

      expect(status.progressPercent).toBe(0);
    });

    test('実行中でない場合、estimatedRemainingSecondsはnullを返す', async () => {
      cyclingActivityRepository.count.mockResolvedValueOnce(4).mockResolvedValueOnce(1);
      const service = await createService();

      const status = await service.getStatus();

      expect(status.estimatedRemainingSeconds).toBeNull();
    });

    test('実行中の場合、残件数とレート制限間隔から残り秒数を見積もる', async () => {
      // 意図的に解決しないPromiseでジョブを実行中のまま保持し、タイミング競合を避ける
      fetchAllCyclingActivities.mockReturnValue(new Promise(() => {}));
      cyclingActivityRepository.count.mockResolvedValueOnce(4).mockResolvedValueOnce(1);
      const service = await createService();
      await service.start();

      const status = await service.getStatus();

      expect(status.isRunning).toBe(true);
      expect(status.estimatedRemainingSeconds).toBe(((4 - 1) * 9000) / 1000);
    });
  });
});
