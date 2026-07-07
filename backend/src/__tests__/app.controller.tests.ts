import { Test } from '@nestjs/testing';
import { describe, expect, test } from 'vitest';
import { AppController } from '../app.controller';
import { AppService } from '../app.service';

describe('AppControllerに関するテスト', () => {
  test('getHealthが呼ばれたとき、AppServiceのgetHealthの戻り値を返す', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService]
    }).compile();
    const controller = moduleRef.get(AppController);

    const result = controller.getHealth();

    expect(result).toEqual({ status: 'ok' });
  });
});
