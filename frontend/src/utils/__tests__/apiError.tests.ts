import { describe, expect, test } from 'vitest';
import { ApiError, buildApiError, toAppErrorInfo } from '../apiError';

describe('buildApiErrorに関するテスト', () => {
  test('レスポンスボディがAppErrorInfo形式の場合、その内容でApiErrorを組み立てる', async () => {
    const response = {
      status: 502,
      json: () =>
        Promise.resolve({ errorCode: 'STRAVA_API_ERROR', message: 'Strava APIとの通信に失敗しました', hint: 'ヒント' })
    } as Response;

    const error = await buildApiError(response);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.errorCode).toBe('STRAVA_API_ERROR');
    expect(error.message).toBe('Strava APIとの通信に失敗しました');
    expect(error.hint).toBe('ヒント');
  });

  test('レスポンスボディがAppErrorInfo形式でない場合、ステータスコードのみの汎用エラーにフォールバックする', async () => {
    const response = { status: 500, json: () => Promise.reject(new Error('invalid json')) } as Response;

    const error = await buildApiError(response);

    expect(error.errorCode).toBe('INTERNAL_ERROR');
    expect(error.message).toContain('500');
  });
});

describe('toAppErrorInfoに関するテスト', () => {
  test('ApiErrorの場合、そのerrorCode/message/hintを返す', () => {
    const error = new ApiError({ errorCode: 'STRAVA_RATE_LIMITED', message: 'レート制限', hint: '待ってください' });

    expect(toAppErrorInfo(error)).toEqual({
      errorCode: 'STRAVA_RATE_LIMITED',
      message: 'レート制限',
      hint: '待ってください'
    });
  });

  test('通常のErrorの場合、INTERNAL_ERRORとしてそのmessageを使う', () => {
    expect(toAppErrorInfo(new Error('network error'))).toEqual({
      errorCode: 'INTERNAL_ERROR',
      message: 'network error',
      hint: null
    });
  });

  test('Errorでない未知の値の場合、INTERNAL_ERRORとして汎用メッセージを使う', () => {
    expect(toAppErrorInfo('some thrown string')).toEqual({
      errorCode: 'INTERNAL_ERROR',
      message: '予期しないエラーが発生しました',
      hint: null
    });
  });
});
