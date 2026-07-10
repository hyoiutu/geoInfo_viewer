// biome-ignore-all lint/style/useNamingConvention: 環境変数名・Strava APIレスポンス形式(snake_case)に合わせたテストダブル
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { of } from 'rxjs';
import { describe, expect, test, vi } from 'vitest';
import { StravaAuthService } from '../strava-auth.service';

const ENV_VALUES: Record<string, string> = {
  STRAVA_CLIENT_ID: 'client-id',
  STRAVA_CLIENT_SECRET: 'client-secret',
  STRAVA_REFRESH_TOKEN: 'initial-refresh-token'
};

const createService = async (httpServicePost: ReturnType<typeof vi.fn>) => {
  const moduleRef = await Test.createTestingModule({
    providers: [
      StravaAuthService,
      { provide: HttpService, useValue: { post: httpServicePost } },
      { provide: ConfigService, useValue: { get: (key: string) => ENV_VALUES[key] } }
    ]
  }).compile();

  return moduleRef.get(StravaAuthService);
};

describe('StravaAuthServiceに関するテスト', () => {
  test('初回呼び出し時、リフレッシュトークンを使ってアクセストークンを取得する', async () => {
    const httpServicePost = vi
      .fn()
      .mockReturnValue(
        of({ data: { access_token: 'access-token-1', expires_at: Math.floor(Date.now() / 1000) + 21600 } })
      );
    const service = await createService(httpServicePost);

    const accessToken = await service.getAccessToken();

    expect(accessToken).toBe('access-token-1');
    expect(httpServicePost).toHaveBeenCalledTimes(1);
  });

  test('有効なアクセストークンをキャッシュ済みの場合、再度リフレッシュを呼ばない', async () => {
    const httpServicePost = vi
      .fn()
      .mockReturnValue(
        of({ data: { access_token: 'access-token-1', expires_at: Math.floor(Date.now() / 1000) + 21600 } })
      );
    const service = await createService(httpServicePost);

    await service.getAccessToken();
    await service.getAccessToken();

    expect(httpServicePost).toHaveBeenCalledTimes(1);
  });

  test('キャッシュ済みのアクセストークンが失効している場合、再度リフレッシュする', async () => {
    const httpServicePost = vi
      .fn()
      .mockReturnValueOnce(
        of({ data: { access_token: 'access-token-1', expires_at: Math.floor(Date.now() / 1000) - 1 } })
      )
      .mockReturnValueOnce(
        of({ data: { access_token: 'access-token-2', expires_at: Math.floor(Date.now() / 1000) + 21600 } })
      );
    const service = await createService(httpServicePost);

    await service.getAccessToken();
    const secondAccessToken = await service.getAccessToken();

    expect(secondAccessToken).toBe('access-token-2');
    expect(httpServicePost).toHaveBeenCalledTimes(2);
  });
});
