import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// biome-ignore lint/style/useNamingConvention: 環境変数名(SCREAMING_SNAKE_CASE)に合わせる
const ENV_KEYS = ['STRAVA_API_BASE_URL', 'STRAVA_OAUTH_TOKEN_URL'] as const;

describe('strava.constantsに関するテスト', () => {
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    }
    vi.resetModules();
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    }
  });

  test('環境変数が未設定の場合、Strava公式のURLをデフォルトとして使う', async () => {
    const { STRAVA_API_BASE_URL, STRAVA_OAUTH_TOKEN_URL } = await import('../strava.constants.js');

    expect(STRAVA_API_BASE_URL).toBe('https://www.strava.com/api/v3');
    expect(STRAVA_OAUTH_TOKEN_URL).toBe('https://www.strava.com/oauth/token');
  });

  test('環境変数が設定されている場合、その値を使う（E2Eでモックサーバーに向けるため）', async () => {
    process.env.STRAVA_API_BASE_URL = 'http://localhost:4010/api/v3';
    process.env.STRAVA_OAUTH_TOKEN_URL = 'http://localhost:4010/oauth/token';

    const { STRAVA_API_BASE_URL, STRAVA_OAUTH_TOKEN_URL } = await import('../strava.constants.js');

    expect(STRAVA_API_BASE_URL).toBe('http://localhost:4010/api/v3');
    expect(STRAVA_OAUTH_TOKEN_URL).toBe('http://localhost:4010/oauth/token');
  });
});
