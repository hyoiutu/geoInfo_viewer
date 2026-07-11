import { defineConfig } from '@playwright/test';

const MOCK_STRAVA_PORT = 4010;
const BACKEND_PORT = 3000;
// E2E実行中はStravaレート制限を極小間隔にし、バックフィル待機を実用的な長さに抑える。
const E2E_STRAVA_RATE_LIMIT_INTERVAL_MS = 50;
// 地図タイル(OSM/航空写真)は実サーバーへ接続するため、タイルデータの経年変化による
// 微小な差分を許容するスクリーンショット比較閾値。
const SCREENSHOT_MAX_DIFF_PIXEL_RATIO = 0.02;

export default defineConfig({
  testDir: './electron/tests',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
    toHaveScreenshot: { maxDiffPixelRatio: SCREENSHOT_MAX_DIFF_PIXEL_RATIO }
  },
  reporter: 'list',
  use: {
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'electron',
      use: {}
    }
  ],
  globalSetup: require.resolve('./electron/tests/global-setup.ts'),
  webServer: [
    {
      command: `node electron/tests/support/mock-strava-server.js`,
      port: MOCK_STRAVA_PORT,
      reuseExistingServer: !process.env.CI
    },
    {
      command: 'pnpm --filter backend run start',
      url: `http://localhost:${BACKEND_PORT}/health`,
      reuseExistingServer: !process.env.CI,
      env: {
        // biome-ignore lint/style/useNamingConvention: 環境変数名(SCREAMING_SNAKE_CASE)に合わせる
        STRAVA_API_BASE_URL: `http://localhost:${MOCK_STRAVA_PORT}/api/v3`,
        // biome-ignore lint/style/useNamingConvention: 環境変数名(SCREAMING_SNAKE_CASE)に合わせる
        STRAVA_OAUTH_TOKEN_URL: `http://localhost:${MOCK_STRAVA_PORT}/oauth/token`,
        // biome-ignore lint/style/useNamingConvention: 環境変数名(SCREAMING_SNAKE_CASE)に合わせる
        STRAVA_RATE_LIMIT_INTERVAL_MS: String(E2E_STRAVA_RATE_LIMIT_INTERVAL_MS),
        // biome-ignore lint/style/useNamingConvention: 環境変数名(SCREAMING_SNAKE_CASE)に合わせる
        STRAVA_CLIENT_ID: 'e2e-dummy',
        // biome-ignore lint/style/useNamingConvention: 環境変数名(SCREAMING_SNAKE_CASE)に合わせる
        STRAVA_CLIENT_SECRET: 'e2e-dummy',
        // biome-ignore lint/style/useNamingConvention: 環境変数名(SCREAMING_SNAKE_CASE)に合わせる
        STRAVA_REFRESH_TOKEN: 'e2e-dummy',
        // biome-ignore lint/style/useNamingConvention: 環境変数名(SCREAMING_SNAKE_CASE)に合わせる
        DATABASE_HOST: 'localhost',
        // biome-ignore lint/style/useNamingConvention: 環境変数名(SCREAMING_SNAKE_CASE)に合わせる
        DATABASE_PORT: '5434',
        // biome-ignore lint/style/useNamingConvention: 環境変数名(SCREAMING_SNAKE_CASE)に合わせる
        DATABASE_USERNAME: 'postgres',
        // biome-ignore lint/style/useNamingConvention: 環境変数名(SCREAMING_SNAKE_CASE)に合わせる
        DATABASE_PASSWORD: 'postgres',
        // biome-ignore lint/style/useNamingConvention: 環境変数名(SCREAMING_SNAKE_CASE)に合わせる
        DATABASE_NAME: 'geo_info_viewer_e2e'
      }
    }
  ]
});
