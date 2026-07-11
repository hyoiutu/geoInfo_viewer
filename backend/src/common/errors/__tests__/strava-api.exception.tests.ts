import { HttpStatus } from '@nestjs/common';
import { describe, expect, test } from 'vitest';
import { APP_ERROR_CODE } from '../app-error-code.constants';
import { toStravaApiException } from '../strava-api.exception';

const createAxiosError = (status: number) => ({
  isAxiosError: true,
  response: { status }
});

describe('toStravaApiExceptionに関するテスト', () => {
  test('401の場合、STRAVA_AUTH_FAILEDのAppExceptionへ変換する', () => {
    const exception = toStravaApiException(createAxiosError(401));

    expect(exception.getStatus()).toBe(HttpStatus.BAD_GATEWAY);
    expect(exception.getResponse()).toEqual(expect.objectContaining({ errorCode: APP_ERROR_CODE.stravaAuthFailed }));
  });

  test('429の場合、STRAVA_RATE_LIMITEDのAppExceptionへ変換する', () => {
    const exception = toStravaApiException(createAxiosError(429));

    expect(exception.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(exception.getResponse()).toEqual(expect.objectContaining({ errorCode: APP_ERROR_CODE.stravaRateLimited }));
  });

  test('それ以外のステータスの場合、STRAVA_API_ERRORのAppExceptionへ変換する', () => {
    const exception = toStravaApiException(createAxiosError(500));

    expect(exception.getStatus()).toBe(HttpStatus.BAD_GATEWAY);
    expect(exception.getResponse()).toEqual(expect.objectContaining({ errorCode: APP_ERROR_CODE.stravaApiError }));
  });

  test('axiosエラーでない場合（ネットワークエラー等）、STRAVA_API_ERRORのAppExceptionへ変換する', () => {
    const exception = toStravaApiException(new Error('network error'));

    expect(exception.getStatus()).toBe(HttpStatus.BAD_GATEWAY);
    expect(exception.getResponse()).toEqual(expect.objectContaining({ errorCode: APP_ERROR_CODE.stravaApiError }));
  });
});
