// biome-ignore-all lint/style/useNamingConvention: 環境変数名・Strava APIレスポンス形式(snake_case)に合わせたテストダブル
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { describe, expect, test, vi } from 'vitest';
import { AppException } from '../../common/errors/app.exception';
import { APP_ERROR_CODE } from '../../common/errors/app-error-code.constants';
import { assertIsAppException } from '../../test-utils/assert-is-app-exception';
import { StravaApiClient } from '../strava-api.client';
import { StravaAuthService } from '../strava-auth.service';

const ENV_VALUES: Record<string, string> = {
  STRAVA_CLIENT_ID: 'client-id',
  STRAVA_CLIENT_SECRET: 'client-secret',
  STRAVA_REFRESH_TOKEN: 'initial-refresh-token'
};

const createService = async (refreshToken: ReturnType<typeof vi.fn>) => {
  const moduleRef = await Test.createTestingModule({
    providers: [
      StravaAuthService,
      { provide: StravaApiClient, useValue: { refreshToken } },
      { provide: ConfigService, useValue: { get: (key: string) => ENV_VALUES[key] } }
    ]
  }).compile();

  return moduleRef.get(StravaAuthService);
};

describe('StravaAuthServiceに関するテスト', () => {
  test('初回呼び出し時、リフレッシュトークンを使ってアクセストークンを取得する', async () => {
    const refreshToken = vi
      .fn()
      .mockResolvedValue({ access_token: 'access-token-1', expires_at: Math.floor(Date.now() / 1000) + 21600 });
    const service = await createService(refreshToken);

    const accessToken = await service.getAccessToken();

    expect(accessToken).toBe('access-token-1');
    expect(refreshToken).toHaveBeenCalledTimes(1);
    expect(refreshToken).toHaveBeenCalledWith({
      clientId: 'client-id',
      clientSecret: 'client-secret',
      refreshToken: 'initial-refresh-token'
    });
  });

  test('有効なアクセストークンをキャッシュ済みの場合、再度リフレッシュを呼ばない', async () => {
    const refreshToken = vi
      .fn()
      .mockResolvedValue({ access_token: 'access-token-1', expires_at: Math.floor(Date.now() / 1000) + 21600 });
    const service = await createService(refreshToken);

    await service.getAccessToken();
    await service.getAccessToken();

    expect(refreshToken).toHaveBeenCalledTimes(1);
  });

  test('キャッシュ済みのアクセストークンが失効している場合、再度リフレッシュする', async () => {
    const refreshToken = vi
      .fn()
      .mockResolvedValueOnce({ access_token: 'access-token-1', expires_at: Math.floor(Date.now() / 1000) - 1 })
      .mockResolvedValueOnce({ access_token: 'access-token-2', expires_at: Math.floor(Date.now() / 1000) + 21600 });
    const service = await createService(refreshToken);

    await service.getAccessToken();
    const secondAccessToken = await service.getAccessToken();

    expect(secondAccessToken).toBe('access-token-2');
    expect(refreshToken).toHaveBeenCalledTimes(2);
  });

  test('トークンリフレッシュに失敗した場合、クライアントが投げたAppExceptionをそのまま伝播する', async () => {
    const refreshToken = vi
      .fn()
      .mockRejectedValue(new AppException(APP_ERROR_CODE.stravaAuthFailed, 'エラー', '対処', 502));
    const service = await createService(refreshToken);

    try {
      await service.getAccessToken();
      expect.unreachable('例外が投げられるはず');
    } catch (error) {
      assertIsAppException(error);
      expect(error.getResponse()).toEqual(expect.objectContaining({ errorCode: APP_ERROR_CODE.stravaAuthFailed }));
    }
  });
});
