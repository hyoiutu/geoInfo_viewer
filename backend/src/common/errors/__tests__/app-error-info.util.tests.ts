import { HttpStatus } from '@nestjs/common';
import { describe, expect, test } from 'vitest';
import { AppException } from '../app.exception';
import { APP_ERROR_CODE } from '../app-error-code.constants';
import { toAppErrorInfo } from '../app-error-info.util';

describe('toAppErrorInfoに関するテスト', () => {
  test('AppExceptionの場合、そのerrorCode/message/hintを返す', () => {
    const exception = new AppException(
      APP_ERROR_CODE.stravaAuthFailed,
      'Strava認証に失敗しました',
      '設定を確認してください',
      HttpStatus.BAD_GATEWAY
    );

    const errorInfo = toAppErrorInfo(exception);

    expect(errorInfo).toEqual({
      errorCode: APP_ERROR_CODE.stravaAuthFailed,
      message: 'Strava認証に失敗しました',
      hint: '設定を確認してください'
    });
  });

  test('通常のErrorの場合、INTERNAL_ERRORとしてそのmessageを使う', () => {
    const errorInfo = toAppErrorInfo(new Error('DB error'));

    expect(errorInfo).toEqual({ errorCode: APP_ERROR_CODE.internalError, message: 'DB error', hint: null });
  });

  test('Errorでない未知の値の場合、INTERNAL_ERRORとして汎用メッセージを使う', () => {
    const errorInfo = toAppErrorInfo('some string thrown');

    expect(errorInfo).toEqual({
      errorCode: APP_ERROR_CODE.internalError,
      message: '予期しないエラーが発生しました',
      hint: null
    });
  });
});
