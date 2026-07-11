import { execSync } from 'node:child_process';
import { Client } from 'pg';

// E2E専用DB(docker-compose.e2e.yml)は、開発用DB(docker-compose.yml)とコンテナ名が衝突しないよう
// 必ずプロジェクト名を明示して起動する（プロジェクト名を省略するとカレントディレクトリ名から
// 同じ名前が導出され、開発用コンテナを上書きしてしまう）。
const E2E_COMPOSE_PROJECT_NAME = 'geo_info_viewer_e2e';
const E2E_DB_HOST = 'localhost';
const E2E_DB_PORT = 5434;
const E2E_DB_USERNAME = 'postgres';
const E2E_DB_PASSWORD = 'postgres';
const E2E_DB_NAME = 'geo_info_viewer_e2e';

const DB_CONNECTION_RETRY_COUNT = 20;
const DB_CONNECTION_RETRY_INTERVAL_MS = 500;

/**
 * 指定したミリ秒だけ待機する
 * @param ms 待機時間（ミリ秒）
 */
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** E2E用DBに接続可能になるまでリトライしながら待機する */
const waitForDatabase = async (): Promise<void> => {
  for (let attempt = 1; attempt <= DB_CONNECTION_RETRY_COUNT; attempt++) {
    const client = new Client({
      host: E2E_DB_HOST,
      port: E2E_DB_PORT,
      user: E2E_DB_USERNAME,
      password: E2E_DB_PASSWORD,
      database: E2E_DB_NAME
    });
    try {
      await client.connect();
      await client.end();
      return;
    } catch {
      await client.end().catch(() => {});
      await sleep(DB_CONNECTION_RETRY_INTERVAL_MS);
    }
  }
  throw new Error(`E2E用DB(${E2E_DB_HOST}:${E2E_DB_PORT})に接続できませんでした`);
};

/** 各テスト実行前に、前回実行の残留データをクリアするためテーブルを空にする */
const truncateTables = async (): Promise<void> => {
  const client = new Client({
    host: E2E_DB_HOST,
    port: E2E_DB_PORT,
    user: E2E_DB_USERNAME,
    password: E2E_DB_PASSWORD,
    database: E2E_DB_NAME
  });
  await client.connect();
  try {
    await client.query('TRUNCATE TABLE cycling_activities, sync_state');
  } finally {
    await client.end();
  }
};

/**
 * Playwrightの`globalSetup`として実行される、E2Eテスト実行前の準備処理。
 * E2E用DBの起動・接続待ち・マイグレーション実行・テーブルのTRUNCATEを行う
 */
async function globalSetup(): Promise<void> {
  execSync(`docker-compose -p ${E2E_COMPOSE_PROJECT_NAME} -f docker-compose.e2e.yml up -d`, { stdio: 'inherit' });

  await waitForDatabase();

  execSync('pnpm --filter backend run migration:run', {
    stdio: 'inherit',
    env: {
      ...process.env,
      // biome-ignore lint/style/useNamingConvention: 環境変数名(SCREAMING_SNAKE_CASE)に合わせる
      DATABASE_HOST: E2E_DB_HOST,
      // biome-ignore lint/style/useNamingConvention: 環境変数名(SCREAMING_SNAKE_CASE)に合わせる
      DATABASE_PORT: String(E2E_DB_PORT),
      // biome-ignore lint/style/useNamingConvention: 環境変数名(SCREAMING_SNAKE_CASE)に合わせる
      DATABASE_USERNAME: E2E_DB_USERNAME,
      // biome-ignore lint/style/useNamingConvention: 環境変数名(SCREAMING_SNAKE_CASE)に合わせる
      DATABASE_PASSWORD: E2E_DB_PASSWORD,
      // biome-ignore lint/style/useNamingConvention: 環境変数名(SCREAMING_SNAKE_CASE)に合わせる
      DATABASE_NAME: E2E_DB_NAME
    }
  });

  await truncateTables();
}

// biome-ignore lint/style/noDefaultExport: PlaywrightのglobalSetupオプションはdefault exportを要求する
export default globalSetup;
