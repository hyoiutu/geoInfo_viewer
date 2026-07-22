import { HttpStatus } from '@nestjs/common';
import type { AxiosError } from 'axios';
import { AppException } from './app.exception';
import { APP_ERROR_CODE } from './app-error-code.constants';

const HTTP_STATUS_UNAUTHORIZED = 401;
const HTTP_STATUS_NOT_FOUND = 404;
const HTTP_STATUS_TOO_MANY_REQUESTS = 429;

/**
 * 値がaxiosのエラーオブジェクトかどうかを判定する
 * @param error 判定対象の値
 * @returns axiosのエラーオブジェクトであればtrue
 */
const isAxiosError = (error: unknown): error is AxiosError =>
  typeof error === 'object' && error !== null && 'isAxiosError' in error && error.isAxiosError === true;

/**
 * HTTPステータスから種別を判別できない場合の、汎用的なGoogle Drive API通信エラーを組み立てる。
 * AppExceptionへの変換で元のエラーの詳細（レスポンス本体・ヘッダー等）が失われ、原因調査ができなく
 * なるため、種別を判別できない＝原因不明な失敗の場合に限り、診断用として元のエラー詳細を
 * ログ出力する（実際に502エラーの原因調査で必要になった、Issue #23）
 * @param error try/catchで捕捉した元の値
 */
const createGenericGoogleDriveApiException = (error: unknown): AppException => {
  console.error('Google Drive APIとの通信で原因不明のエラーが発生しました。診断用の詳細:', error);
  return new AppException(
    APP_ERROR_CODE.googleDriveApiError,
    'Google Drive APIとの通信に失敗しました',
    'しばらく時間をおいてから再度お試しください',
    HttpStatus.BAD_GATEWAY
  );
};

/**
 * Google Drive API呼び出し(axios)で発生したエラーを、レスポンスのHTTPステータスに応じて
 * 種別ごとのAppExceptionへ変換する。呼び出し元(GoogleDriveAuthService/GoogleDriveApiClient)は
 * これをそのままthrowするだけでよい。
 * @param error try/catchで捕捉した不明な値
 * @returns 種別ごとに変換されたAppException
 */
export const toGoogleDriveApiException = (error: unknown): AppException => {
  if (!isAxiosError(error)) {
    return createGenericGoogleDriveApiException(error);
  }

  const status = error.response?.status;

  if (status === HTTP_STATUS_UNAUTHORIZED) {
    return new AppException(
      APP_ERROR_CODE.googleDriveAuthFailed,
      'Google Drive認証に失敗しました',
      'サーバーのGoogle Drive連携設定（アクセストークン）を確認してください',
      HttpStatus.BAD_GATEWAY
    );
  }

  if (status === HTTP_STATUS_NOT_FOUND) {
    return new AppException(
      APP_ERROR_CODE.googleDriveFileNotFound,
      '指定されたGoogle Driveファイルが見つかりません',
      'ファイルIDが正しいか、対象ファイルへのアクセス権があるか確認してください',
      HttpStatus.NOT_FOUND
    );
  }

  if (status === HTTP_STATUS_TOO_MANY_REQUESTS) {
    return new AppException(
      APP_ERROR_CODE.googleDriveRateLimited,
      'Google Drive APIのレート制限に達しました',
      'しばらく時間をおいてから再度お試しください',
      HttpStatus.TOO_MANY_REQUESTS
    );
  }

  return createGenericGoogleDriveApiException(error);
};
