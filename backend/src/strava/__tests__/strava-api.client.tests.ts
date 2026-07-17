// biome-ignore-all lint/style/useNamingConvention: Strava APIレスポンス形式(snake_case)に合わせたテストダブル
import { HttpService } from '@nestjs/axios';
import { Test } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import { describe, expect, test, vi } from 'vitest';
import { APP_ERROR_CODE } from '../../common/errors/app-error-code.constants';
import { assertIsAppException } from '../../test-utils/assert-is-app-exception';
import { StravaApiClient } from '../strava-api.client';
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

describe('StravaApiClientに関するテスト', () => {
  const createClient = async (httpServiceGet: ReturnType<typeof vi.fn>, httpServicePost: ReturnType<typeof vi.fn>) => {
    const moduleRef = await Test.createTestingModule({
      providers: [StravaApiClient, { provide: HttpService, useValue: { get: httpServiceGet, post: httpServicePost } }]
    }).compile();

    return moduleRef.get(StravaApiClient);
  };

  describe('getActivities', () => {
    test('アクセストークンをAuthorizationヘッダーに含め、レスポンスのdataをそのまま返す', async () => {
      const activities = [createActivity({ id: 1 }), createActivity({ id: 2, type: 'Run' })];
      const httpServiceGet = vi.fn().mockReturnValue(of({ data: activities }));
      const client = await createClient(httpServiceGet, vi.fn());

      const result = await client.getActivities('token-xyz');

      expect(result).toEqual(activities);
      expect(httpServiceGet).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ headers: { Authorization: 'Bearer token-xyz' } })
      );
    });

    test('afterEpochSeconds/perPage/pageを指定した場合、対応するクエリパラメータに変換して渡す', async () => {
      const httpServiceGet = vi.fn().mockReturnValue(of({ data: [] }));
      const client = await createClient(httpServiceGet, vi.fn());

      await client.getActivities('token-xyz', { afterEpochSeconds: 1000, perPage: 200, page: 2 });

      expect(httpServiceGet).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ params: { after: 1000, per_page: 200, page: 2 } })
      );
    });

    test('パラメータを何も指定しない場合、paramsはundefinedになる', async () => {
      const httpServiceGet = vi.fn().mockReturnValue(of({ data: [] }));
      const client = await createClient(httpServiceGet, vi.fn());

      await client.getActivities('token-xyz');

      expect(httpServiceGet).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ params: undefined }));
    });

    test('失敗した場合、errorCode: STRAVA_API_ERRORのAppExceptionを投げる', async () => {
      const httpServiceGet = vi
        .fn()
        .mockReturnValue(throwError(() => ({ isAxiosError: true, response: { status: 500 } })));
      const client = await createClient(httpServiceGet, vi.fn());

      try {
        await client.getActivities('token-xyz');
        expect.unreachable('例外が投げられるはず');
      } catch (error) {
        assertIsAppException(error);
        expect(error.getResponse()).toEqual(expect.objectContaining({ errorCode: APP_ERROR_CODE.stravaApiError }));
      }
    });

    test('レート制限(429)で失敗した場合、errorCode: STRAVA_RATE_LIMITEDのAppExceptionを投げる', async () => {
      const httpServiceGet = vi
        .fn()
        .mockReturnValue(throwError(() => ({ isAxiosError: true, response: { status: 429 } })));
      const client = await createClient(httpServiceGet, vi.fn());

      try {
        await client.getActivities('token-xyz');
        expect.unreachable('例外が投げられるはず');
      } catch (error) {
        assertIsAppException(error);
        expect(error.getResponse()).toEqual(expect.objectContaining({ errorCode: APP_ERROR_CODE.stravaRateLimited }));
      }
    });
  });

  describe('getActivityDetail', () => {
    test('指定したIDのアクティビティ詳細をStravaから取得して返す', async () => {
      const detail = createActivityDetail({ id: 42, map: { summary_polyline: 'abc', polyline: 'xyz' } });
      const httpServiceGet = vi.fn().mockReturnValue(of({ data: detail }));
      const client = await createClient(httpServiceGet, vi.fn());

      const result = await client.getActivityDetail('token-xyz', 42);

      expect(result).toEqual(detail);
      expect(httpServiceGet).toHaveBeenCalledWith(
        expect.stringContaining('/activities/42'),
        expect.objectContaining({ headers: { Authorization: 'Bearer token-xyz' } })
      );
    });

    test('失敗した場合、errorCode: STRAVA_API_ERRORのAppExceptionを投げる', async () => {
      const httpServiceGet = vi.fn().mockReturnValue(throwError(() => new Error('network error')));
      const client = await createClient(httpServiceGet, vi.fn());

      try {
        await client.getActivityDetail('token-xyz', 1);
        expect.unreachable('例外が投げられるはず');
      } catch (error) {
        assertIsAppException(error);
        expect(error.getResponse()).toEqual(expect.objectContaining({ errorCode: APP_ERROR_CODE.stravaApiError }));
      }
    });
  });

  describe('refreshToken', () => {
    test('client_id/client_secret/refresh_token/grant_typeをボディに含めてPOSTし、レスポンスのdataを返す', async () => {
      const tokenResponse = { access_token: 'access-token-1', expires_at: 1234567890 };
      const httpServicePost = vi.fn().mockReturnValue(of({ data: tokenResponse }));
      const client = await createClient(vi.fn(), httpServicePost);

      const result = await client.refreshToken({
        clientId: 'client-id',
        clientSecret: 'client-secret',
        refreshToken: 'refresh-token'
      });

      expect(result).toEqual(tokenResponse);
      expect(httpServicePost).toHaveBeenCalledWith(expect.any(String), {
        client_id: 'client-id',
        client_secret: 'client-secret',
        refresh_token: 'refresh-token',
        grant_type: 'refresh_token'
      });
    });

    test('失敗した場合、errorCode: STRAVA_AUTH_FAILEDのAppExceptionを投げる(401)', async () => {
      const httpServicePost = vi
        .fn()
        .mockReturnValue(throwError(() => ({ isAxiosError: true, response: { status: 401 } })));
      const client = await createClient(vi.fn(), httpServicePost);

      try {
        await client.refreshToken({ clientId: 'a', clientSecret: 'b', refreshToken: 'c' });
        expect.unreachable('例外が投げられるはず');
      } catch (error) {
        assertIsAppException(error);
        expect(error.getResponse()).toEqual(expect.objectContaining({ errorCode: APP_ERROR_CODE.stravaAuthFailed }));
      }
    });
  });
});
