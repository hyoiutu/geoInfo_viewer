// biome-ignore-all lint/style/useNamingConvention: Strava APIレスポンス形式(snake_case)に合わせたテストダブル
import { HttpService } from '@nestjs/axios';
import { Test } from '@nestjs/testing';
import { of } from 'rxjs';
import { describe, expect, test, vi } from 'vitest';
import { StravaActivitiesService } from '../strava-activities.service';
import { StravaAuthService } from '../strava-auth.service';
import { StravaRateLimiterService } from '../strava-rate-limiter.service';
import type { StravaActivity, StravaActivityDetail } from '../types/strava-activity.type';

const createActivity = (overrides: Partial<StravaActivity>): StravaActivity => ({
  id: 1,
  name: 'テストライド',
  type: 'Ride',
  distance: 10000,
  moving_time: 1800,
  start_date: '2026-07-01T00:00:00Z',
  map: { summary_polyline: '' },
  ...overrides
});

const createActivityDetail = (overrides: Partial<StravaActivityDetail>): StravaActivityDetail => ({
  id: 1,
  name: 'テストライド',
  type: 'Ride',
  distance: 10000,
  moving_time: 1800,
  start_date: '2026-07-01T00:00:00Z',
  map: { summary_polyline: '', polyline: '' },
  ...overrides
});

describe('StravaActivitiesServiceに関するテスト', () => {
  const createService = async (httpServiceGet: ReturnType<typeof vi.fn>) => {
    const waitForSlot = vi.fn().mockResolvedValue(undefined);
    const moduleRef = await Test.createTestingModule({
      providers: [
        StravaActivitiesService,
        { provide: HttpService, useValue: { get: httpServiceGet } },
        { provide: StravaAuthService, useValue: { getAccessToken: vi.fn().mockResolvedValue('token-xyz') } },
        { provide: StravaRateLimiterService, useValue: { waitForSlot } }
      ]
    }).compile();

    return { service: moduleRef.get(StravaActivitiesService), waitForSlot };
  };

  test('fetchCyclingActivitiesが呼ばれたとき、Ride/VirtualRide以外のアクティビティは除外される', async () => {
    const httpServiceGet = vi.fn().mockReturnValue(
      of({
        data: [
          createActivity({ id: 1, type: 'Ride' }),
          createActivity({ id: 2, type: 'Run' }),
          createActivity({ id: 3, type: 'VirtualRide' })
        ]
      })
    );
    const { service } = await createService(httpServiceGet);

    const activities = await service.fetchCyclingActivities();

    expect(activities.map((activity) => activity.id)).toEqual([1, 3]);
  });

  test('fetchCyclingActivitiesが呼ばれたとき、アクセストークンをAuthorizationヘッダーに含める', async () => {
    const httpServiceGet = vi.fn().mockReturnValue(of({ data: [] }));
    const { service } = await createService(httpServiceGet);

    await service.fetchCyclingActivities();

    expect(httpServiceGet).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ headers: { Authorization: 'Bearer token-xyz' } })
    );
  });

  describe('fetchAllCyclingActivities', () => {
    test('ページを最終ページ（空配列）まで辿り、全ページの自転車アクティビティを結合して返す', async () => {
      const httpServiceGet = vi
        .fn()
        .mockReturnValueOnce(of({ data: [createActivity({ id: 1 }), createActivity({ id: 2, type: 'Run' })] }))
        .mockReturnValueOnce(of({ data: [createActivity({ id: 3 })] }))
        .mockReturnValueOnce(of({ data: [] }));
      const { service } = await createService(httpServiceGet);

      const activities = await service.fetchAllCyclingActivities();

      expect(activities.map((activity) => activity.id)).toEqual([1, 3]);
      expect(httpServiceGet).toHaveBeenCalledTimes(3);
      expect(httpServiceGet).toHaveBeenNthCalledWith(
        1,
        expect.any(String),
        expect.objectContaining({ params: { per_page: 200, page: 1 } })
      );
      expect(httpServiceGet).toHaveBeenNthCalledWith(
        2,
        expect.any(String),
        expect.objectContaining({ params: { per_page: 200, page: 2 } })
      );
    });

    test('各ページ取得の前にレート制限の空き待ちを行う', async () => {
      const httpServiceGet = vi.fn().mockReturnValue(of({ data: [] }));
      const { service, waitForSlot } = await createService(httpServiceGet);

      await service.fetchAllCyclingActivities();

      expect(waitForSlot).toHaveBeenCalledTimes(1);
    });
  });

  describe('fetchCyclingActivityDetail', () => {
    test('指定したIDのアクティビティ詳細をStravaから取得して返す', async () => {
      const detail = createActivityDetail({ id: 42, map: { summary_polyline: 'abc', polyline: 'xyz' } });
      const httpServiceGet = vi.fn().mockReturnValue(of({ data: detail }));
      const { service } = await createService(httpServiceGet);

      const result = await service.fetchCyclingActivityDetail(42);

      expect(result).toEqual(detail);
      expect(httpServiceGet).toHaveBeenCalledWith(
        expect.stringContaining('/activities/42'),
        expect.objectContaining({ headers: { Authorization: 'Bearer token-xyz' } })
      );
    });

    test('取得前にレート制限の空き待ちを行う', async () => {
      const httpServiceGet = vi.fn().mockReturnValue(of({ data: createActivityDetail({ id: 1 }) }));
      const { service, waitForSlot } = await createService(httpServiceGet);

      await service.fetchCyclingActivityDetail(1);

      expect(waitForSlot).toHaveBeenCalledTimes(1);
    });
  });
});
