import { describe, expect, test } from 'vitest';
import { AppService } from '../app.service';

describe('AppServiceに関するテスト', () => {
  test('getHealthが呼ばれたとき、statusがokのオブジェクトを返す', () => {
    const service = new AppService();

    const result = service.getHealth();

    expect(result).toEqual({ status: 'ok' });
  });
});
