import { HttpStatus } from '@nestjs/common';
import { describe, expect, test } from 'vitest';
import { APP_ERROR_CODE } from '../app-error-code.constants';
import { isTransientGoogleDriveApiError, toGoogleDriveApiException } from '../google-drive-api.exception';

const createAxiosError = (status: number) => ({
  isAxiosError: true,
  response: { status }
});

describe('toGoogleDriveApiExceptionに関するテスト', () => {
  test('401の場合、GOOGLE_DRIVE_AUTH_FAILEDのAppExceptionへ変換する', () => {
    const exception = toGoogleDriveApiException(createAxiosError(401));

    expect(exception.getStatus()).toBe(HttpStatus.BAD_GATEWAY);
    expect(exception.getResponse()).toEqual(
      expect.objectContaining({ errorCode: APP_ERROR_CODE.googleDriveAuthFailed })
    );
  });

  test('404の場合、GOOGLE_DRIVE_FILE_NOT_FOUNDのAppExceptionへ変換する', () => {
    const exception = toGoogleDriveApiException(createAxiosError(404));

    expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND);
    expect(exception.getResponse()).toEqual(
      expect.objectContaining({ errorCode: APP_ERROR_CODE.googleDriveFileNotFound })
    );
  });

  test('429の場合、GOOGLE_DRIVE_RATE_LIMITEDのAppExceptionへ変換する', () => {
    const exception = toGoogleDriveApiException(createAxiosError(429));

    expect(exception.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(exception.getResponse()).toEqual(
      expect.objectContaining({ errorCode: APP_ERROR_CODE.googleDriveRateLimited })
    );
  });

  test('それ以外のステータスの場合、GOOGLE_DRIVE_API_ERRORのAppExceptionへ変換する', () => {
    const exception = toGoogleDriveApiException(createAxiosError(500));

    expect(exception.getStatus()).toBe(HttpStatus.BAD_GATEWAY);
    expect(exception.getResponse()).toEqual(expect.objectContaining({ errorCode: APP_ERROR_CODE.googleDriveApiError }));
  });

  test('axiosエラーでない場合（ネットワークエラー等）、GOOGLE_DRIVE_API_ERRORのAppExceptionへ変換する', () => {
    const exception = toGoogleDriveApiException(new Error('network error'));

    expect(exception.getStatus()).toBe(HttpStatus.BAD_GATEWAY);
    expect(exception.getResponse()).toEqual(expect.objectContaining({ errorCode: APP_ERROR_CODE.googleDriveApiError }));
  });
});

describe('isTransientGoogleDriveApiErrorに関するテスト（Issue #106フォローアップ）', () => {
  test('axiosエラーでレスポンスを受け取れなかった場合（EPIPE等の接続断）、trueを返す', () => {
    const error = { isAxiosError: true, code: 'EPIPE' };

    expect(isTransientGoogleDriveApiError(error)).toBe(true);
  });

  test('axiosエラーでサーバーから明示的なレスポンス（404等）を受け取った場合、falseを返す', () => {
    expect(isTransientGoogleDriveApiError(createAxiosError(404))).toBe(false);
  });

  test('axiosエラーでない場合、falseを返す', () => {
    expect(isTransientGoogleDriveApiError(new Error('network error'))).toBe(false);
  });
});
