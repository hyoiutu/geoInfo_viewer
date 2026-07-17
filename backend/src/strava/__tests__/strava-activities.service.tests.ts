// biome-ignore-all lint/style/useNamingConvention: Strava APIレスポンス形式(snake_case)に合わせたテストダブル
import { Test } from '@nestjs/testing';
import { describe, expect, test, vi } from 'vitest';
import { AppException } from '../../common/errors/app.exception';
import { APP_ERROR_CODE } from '../../common/errors/app-error-code.constants';
import { assertIsAppException } from '../../test-utils/assert-is-app-exception';
import { StravaActivitiesService } from '../strava-activities.service';
import { StravaApiClient } from '../strava-api.client';
import { StravaAuthService } from '../strava-auth.service';
import { StravaRateLimiterService } from '../strava-rate-limiter.service';
import type { StravaActivity, StravaActivityDetail } from '../types/strava-activity.type';

const createActivity = (overrides: Partial<StravaActivity>): StravaActivity => ({
  id: 1,
  name: 'テストライド',
  type: 'Ride',
  distance: 10000,
  moving_time: 1800,
  elapsed_time: 1900,
  total_elevation_gain: 100,
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
  elapsed_time: 1900,
  total_elevation_gain: 100,
  start_date: '2026-07-01T00:00:00Z',
  map: { summary_polyline: '', polyline: '' },
  ...overrides
});

describe('StravaActivitiesServiceに関するテスト', () => {
  const createService = async (
    getActivities: ReturnType<typeof vi.fn>,
    getActivityDetail: ReturnType<typeof vi.fn> = vi.fn()
  ) => {
    const waitForSlot = vi.fn().mockResolvedValue(undefined);
    const moduleRef = await Test.createTestingModule({
      providers: [
        StravaActivitiesService,
        { provide: StravaApiClient, useValue: { getActivities, getActivityDetail } },
        { provide: StravaAuthService, useValue: { getAccessToken: vi.fn().mockResolvedValue('token-xyz') } },
        { provide: StravaRateLimiterService, useValue: { waitForSlot } }
      ]
    }).compile();

    return { service: moduleRef.get(StravaActivitiesService), waitForSlot };
  };

  test('fetchCyclingActivitiesが呼ばれたとき、Ride/VirtualRide以外のアクティビティは除外される', async () => {
    const getActivities = vi
      .fn()
      .mockResolvedValue([
        createActivity({ id: 1, type: 'Ride' }),
        createActivity({ id: 2, type: 'Run' }),
        createActivity({ id: 3, type: 'VirtualRide' })
      ]);
    const { service } = await createService(getActivities);

    const activities = await service.fetchCyclingActivities();

    expect(activities.map((activity) => activity.id)).toEqual([1, 3]);
  });

  test('fetchCyclingActivitiesが呼ばれたとき、アクセストークンとafterEpochSecondsをクライアントへ渡す', async () => {
    const getActivities = vi.fn().mockResolvedValue([]);
    const { service } = await createService(getActivities);

    await service.fetchCyclingActivities({ afterEpochSeconds: 1000 });

    expect(getActivities).toHaveBeenCalledWith('token-xyz', { afterEpochSeconds: 1000 });
  });

  test('fetchCyclingActivitiesが失敗した場合、クライアントが投げたAppExceptionをそのまま伝播する', async () => {
    const getActivities = vi
      .fn()
      .mockRejectedValue(new AppException(APP_ERROR_CODE.stravaApiError, 'エラー', '対処', 502));
    const { service } = await createService(getActivities);

    try {
      await service.fetchCyclingActivities();
      expect.unreachable('例外が投げられるはず');
    } catch (error) {
      assertIsAppException(error);
      expect(error.getResponse()).toEqual(expect.objectContaining({ errorCode: APP_ERROR_CODE.stravaApiError }));
    }
  });

  describe('fetchAllCyclingActivities', () => {
    test('ページを最終ページ（空配列）まで辿り、全ページの自転車アクティビティを結合して返す', async () => {
      // 呼び出し順ではなく、リクエストのpageパラメータの値に応じてそのページのデータを返す
      const pages: Record<number, StravaActivity[]> = {
        1: [createActivity({ id: 1 }), createActivity({ id: 2, type: 'Run' })],
        2: [createActivity({ id: 3 })],
        3: []
      };
      const getActivities = vi
        .fn()
        .mockImplementation((_accessToken: string, params: { page: number }) =>
          Promise.resolve(pages[params.page] ?? [])
        );
      const { service } = await createService(getActivities);

      const activities = await service.fetchAllCyclingActivities();

      expect(activities.map((activity) => activity.id)).toEqual([1, 3]);
      expect(getActivities).toHaveBeenCalledTimes(3);
      expect(getActivities).toHaveBeenNthCalledWith(1, 'token-xyz', { perPage: 200, page: 1 });
      expect(getActivities).toHaveBeenNthCalledWith(2, 'token-xyz', { perPage: 200, page: 2 });
    });

    test('各ページ取得の前にレート制限の空き待ちを行う', async () => {
      const getActivities = vi.fn().mockResolvedValue([]);
      const { service, waitForSlot } = await createService(getActivities);

      await service.fetchAllCyclingActivities();

      expect(waitForSlot).toHaveBeenCalledTimes(1);
    });

    test('ページ取得に失敗した場合、クライアントが投げたAppExceptionをそのまま伝播する', async () => {
      const getActivities = vi
        .fn()
        .mockRejectedValue(new AppException(APP_ERROR_CODE.stravaRateLimited, 'エラー', '対処', 429));
      const { service } = await createService(getActivities);

      try {
        await service.fetchAllCyclingActivities();
        expect.unreachable('例外が投げられるはず');
      } catch (error) {
        assertIsAppException(error);
        expect(error.getResponse()).toEqual(expect.objectContaining({ errorCode: APP_ERROR_CODE.stravaRateLimited }));
      }
    });
  });

  describe('fetchCyclingActivityDetail', () => {
    test('指定したIDのアクティビティ詳細をクライアント経由で取得して返す', async () => {
      const detail = createActivityDetail({ id: 42, map: { summary_polyline: 'abc', polyline: 'xyz' } });
      const getActivityDetail = vi.fn().mockResolvedValue(detail);
      const { service } = await createService(vi.fn(), getActivityDetail);

      const result = await service.fetchCyclingActivityDetail(42);

      expect(result).toEqual(detail);
      expect(getActivityDetail).toHaveBeenCalledWith('token-xyz', 42);
    });

    test('取得前にレート制限の空き待ちを行う', async () => {
      const getActivityDetail = vi.fn().mockResolvedValue(createActivityDetail({ id: 1 }));
      const { service, waitForSlot } = await createService(vi.fn(), getActivityDetail);

      await service.fetchCyclingActivityDetail(1);

      expect(waitForSlot).toHaveBeenCalledTimes(1);
    });

    test('取得に失敗した場合、クライアントが投げたAppExceptionをそのまま伝播する', async () => {
      const getActivityDetail = vi
        .fn()
        .mockRejectedValue(new AppException(APP_ERROR_CODE.stravaApiError, 'エラー', '対処', 502));
      const { service } = await createService(vi.fn(), getActivityDetail);

      try {
        await service.fetchCyclingActivityDetail(1);
        expect.unreachable('例外が投げられるはず');
      } catch (error) {
        assertIsAppException(error);
        expect(error.getResponse()).toEqual(expect.objectContaining({ errorCode: APP_ERROR_CODE.stravaApiError }));
      }
    });
  });
});
