// biome-ignore-all lint/style/useNamingConvention: 環境変数名(UPPER_SNAKE_CASE)に合わせたテストダブル
import { describe, expect, test } from 'vitest';
import { createDataSourceOptions } from '../database.config';

describe('createDataSourceOptionsに関するテスト', () => {
  test('DATABASE_PORTが指定されている場合、数値に変換して使用する', () => {
    const env: NodeJS.ProcessEnv = {
      DATABASE_HOST: 'db.example.com',
      DATABASE_PORT: '5433',
      DATABASE_USERNAME: 'user',
      DATABASE_PASSWORD: 'pass',
      DATABASE_NAME: 'mydb'
    };
    const options = createDataSourceOptions(env);

    expect(options.host).toBe('db.example.com');
    expect(options.port).toBe(5433);
    expect(options.username).toBe('user');
    expect(options.password).toBe('pass');
    expect(options.database).toBe('mydb');
  });

  test('DATABASE_PORTが未指定の場合、デフォルトの5432が使われる', () => {
    const env: NodeJS.ProcessEnv = {};
    const options = createDataSourceOptions(env);

    expect(options.port).toBe(5432);
  });
});
