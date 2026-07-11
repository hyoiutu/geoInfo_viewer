import { BadRequestException, HttpStatus } from '@nestjs/common';
import { describe, expect, test, vi } from 'vitest';
import { AllExceptionsFilter } from '../all-exceptions.filter';
import { AppException } from '../app.exception';
import { APP_ERROR_CODE } from '../app-error-code.constants';

const createHost = () => {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) })
  };
  return { host, status, json };
};

describe('AllExceptionsFilterに関するテスト', () => {
  test('AppExceptionの場合、そのステータス・ボディをそのまま返す', () => {
    const filter = new AllExceptionsFilter();
    const { host, status, json } = createHost();
    const exception = new AppException(
      APP_ERROR_CODE.stravaAuthFailed,
      'Strava認証に失敗しました',
      '設定を確認してください',
      HttpStatus.BAD_GATEWAY
    );

    // biome-ignore lint/suspicious/noExplicitAny: NestJSのArgumentsHostはテストダブルで型を簡略化する
    filter.catch(exception, host as any);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_GATEWAY);
    expect(json).toHaveBeenCalledWith({
      errorCode: APP_ERROR_CODE.stravaAuthFailed,
      message: 'Strava認証に失敗しました',
      hint: '設定を確認してください'
    });
  });

  test('AppErrorInfo形式を持たないHttpExceptionの場合、INTERNAL_ERRORへ整形する', () => {
    const filter = new AllExceptionsFilter();
    const { host, status, json } = createHost();
    const exception = new BadRequestException('不正なリクエストです');

    // biome-ignore lint/suspicious/noExplicitAny: NestJSのArgumentsHostはテストダブルで型を簡略化する
    filter.catch(exception, host as any);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: APP_ERROR_CODE.internalError, message: '不正なリクエストです' })
    );
  });

  test('HttpExceptionでない未知のエラーの場合、500・INTERNAL_ERRORを返す', () => {
    const filter = new AllExceptionsFilter();
    const { host, status, json } = createHost();

    // biome-ignore lint/suspicious/noExplicitAny: NestJSのArgumentsHostはテストダブルで型を簡略化する
    filter.catch(new Error('unexpected'), host as any);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ errorCode: APP_ERROR_CODE.internalError }));
  });
});
