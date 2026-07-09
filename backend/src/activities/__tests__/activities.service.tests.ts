// biome-ignore-all lint/style/useNamingConvention: Strava APIレスポンス形式(snake_case)に合わせたテストダブル
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { StravaActivitiesService } from '../../strava/strava-activities.service';
import type { StravaActivity, StravaActivityDetail } from '../../strava/types/strava-activity.type';
import { ActivitiesService } from '../activities.service';
import { ActivitiesBackfillService } from '../activities-backfill.service';
import { CyclingActivityEntity } from '../entities/cycling-activity.entity';
import { SYNC_STATE_SINGLETON_ID, SyncStateEntity } from '../entities/sync-state.entity';

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

describe('ActivitiesServiceに関するテスト', () => {
  let fetchCyclingActivities: ReturnType<typeof vi.fn>;
  let fetchCyclingActivityDetail: ReturnType<typeof vi.fn>;
  let isRunning: ReturnType<typeof vi.fn>;
  let cyclingActivityRepository: { find: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn> };
  let syncStateRepository: {
    findOneBy: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };

  const createService = async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ActivitiesService,
        { provide: StravaActivitiesService, useValue: { fetchCyclingActivities, fetchCyclingActivityDetail } },
        { provide: ActivitiesBackfillService, useValue: { isRunning } },
        { provide: getRepositoryToken(CyclingActivityEntity), useValue: cyclingActivityRepository },
        { provide: getRepositoryToken(SyncStateEntity), useValue: syncStateRepository }
      ]
    }).compile();

    return moduleRef.get(ActivitiesService);
  };

  beforeEach(() => {
    fetchCyclingActivities = vi.fn();
    fetchCyclingActivityDetail = vi.fn();
    isRunning = vi.fn().mockReturnValue(false);
    cyclingActivityRepository = { find: vi.fn(), save: vi.fn() };
    syncStateRepository = {
      findOneBy: vi.fn(),
      create: vi.fn((entity: Partial<SyncStateEntity>) => entity as SyncStateEntity),
      save: vi.fn()
    };
  });

  describe('findAll', () => {
    test('DBに保存されたアクティビティをDTOへ変換して返す', async () => {
      const entity1 = Object.assign(new CyclingActivityEntity(), {
        id: 1,
        name: 'ライド1',
        distanceMeters: 1000,
        movingTimeSeconds: 600,
        startDate: new Date('2026-07-01T00:00:00Z'),
        path: null,
        detailFetchedAt: null
      });
      cyclingActivityRepository.find.mockResolvedValue([entity1]);
      const service = await createService();

      const result = await service.findAll();

      expect(result).toEqual([expect.objectContaining({ id: 1, name: 'ライド1' })]);
    });
  });

  describe('sync', () => {
    test('バックフィル実行中の場合、Strava APIを呼び出さずsuccess:falseを返す', async () => {
      isRunning.mockReturnValue(true);
      const service = await createService();

      const result = await service.sync();

      expect(result).toEqual({ success: false });
      expect(fetchCyclingActivities).not.toHaveBeenCalled();
      expect(fetchCyclingActivityDetail).not.toHaveBeenCalled();
    });

    test('前回同期状態が無い場合、after指定なしでStravaを呼び出す', async () => {
      syncStateRepository.findOneBy.mockResolvedValue(null);
      fetchCyclingActivities.mockResolvedValue([]);
      const service = await createService();

      const result = await service.sync();

      expect(fetchCyclingActivities).toHaveBeenCalledWith({ afterEpochSeconds: undefined });
      expect(result).toEqual({ success: true });
    });

    test('前回同期状態がある場合、その日時をepoch秒に変換してStravaを呼び出す', async () => {
      const lastSyncedAt = new Date('2026-07-01T00:00:00Z');
      syncStateRepository.findOneBy.mockResolvedValue(
        Object.assign(new SyncStateEntity(), { id: SYNC_STATE_SINGLETON_ID, lastSyncedAt })
      );
      fetchCyclingActivities.mockResolvedValue([]);
      const service = await createService();

      await service.sync();

      expect(fetchCyclingActivities).toHaveBeenCalledWith({
        afterEpochSeconds: Math.floor(lastSyncedAt.getTime() / 1000)
      });
    });

    test('新規アクティビティごとに詳細APIを呼び出し、高解像度のpathでDBを更新する', async () => {
      syncStateRepository.findOneBy.mockResolvedValue(null);
      fetchCyclingActivities.mockResolvedValue([createActivity({ id: 1 }), createActivity({ id: 2 })]);
      fetchCyclingActivityDetail.mockImplementation((id: number) =>
        Promise.resolve(
          createActivityDetail({ id, map: { summary_polyline: '', polyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' } })
        )
      );
      const service = await createService();

      const result = await service.sync();

      expect(fetchCyclingActivityDetail).toHaveBeenCalledWith(1);
      expect(fetchCyclingActivityDetail).toHaveBeenCalledWith(2);
      expect(cyclingActivityRepository.save).toHaveBeenCalledWith([
        expect.objectContaining({ id: 1, path: expect.objectContaining({ type: 'LineString' }) }),
        expect.objectContaining({ id: 2, path: expect.objectContaining({ type: 'LineString' }) })
      ]);
      expect(syncStateRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: SYNC_STATE_SINGLETON_ID, lastSyncedAt: expect.any(Date) })
      );
      expect(result).toEqual({ success: true });
    });

    test('新規アクティビティが無い場合、詳細APIを呼び出さずDBも更新しないが同期時刻は更新する', async () => {
      syncStateRepository.findOneBy.mockResolvedValue(null);
      fetchCyclingActivities.mockResolvedValue([]);
      const service = await createService();

      await service.sync();

      expect(fetchCyclingActivityDetail).not.toHaveBeenCalled();
      expect(cyclingActivityRepository.save).not.toHaveBeenCalled();
      expect(syncStateRepository.save).toHaveBeenCalled();
    });

    test('一覧APIの呼び出しが失敗した場合、success:falseを返しDBを更新しない', async () => {
      syncStateRepository.findOneBy.mockResolvedValue(null);
      fetchCyclingActivities.mockRejectedValue(new Error('Strava API error'));
      const service = await createService();

      const result = await service.sync();

      expect(result).toEqual({ success: false });
      expect(cyclingActivityRepository.save).not.toHaveBeenCalled();
      expect(syncStateRepository.save).not.toHaveBeenCalled();
    });

    test('詳細APIの呼び出しが失敗した場合、success:falseを返しDBを更新しない', async () => {
      syncStateRepository.findOneBy.mockResolvedValue(null);
      fetchCyclingActivities.mockResolvedValue([createActivity({ id: 1 })]);
      fetchCyclingActivityDetail.mockRejectedValue(new Error('Strava API error'));
      const service = await createService();

      const result = await service.sync();

      expect(result).toEqual({ success: false });
      expect(cyclingActivityRepository.save).not.toHaveBeenCalled();
      expect(syncStateRepository.save).not.toHaveBeenCalled();
    });

    test('DBへの保存が失敗した場合、success:falseを返す', async () => {
      syncStateRepository.findOneBy.mockResolvedValue(null);
      fetchCyclingActivities.mockResolvedValue([createActivity({ id: 1 })]);
      fetchCyclingActivityDetail.mockResolvedValue(createActivityDetail({ id: 1 }));
      cyclingActivityRepository.save.mockRejectedValue(new Error('DB error'));
      const service = await createService();

      const result = await service.sync();

      expect(result).toEqual({ success: false });
    });
  });
});
