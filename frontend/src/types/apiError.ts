/** エラー種別を表す識別子（backend/src/common/errors/app-error-code.constants.tsと対応） */
export type AppErrorCode = 'STRAVA_AUTH_FAILED' | 'STRAVA_RATE_LIMITED' | 'STRAVA_API_ERROR' | 'INTERNAL_ERROR';

/** バックエンドの全エンドポイントが共通で返すエラーレスポンス形式(backend/src/common/errors/app-error-info.type.tsと対応) */
export type AppErrorInfo = {
  /** フロントエンドが種別ごとの分岐に使う識別子 */
  errorCode: AppErrorCode;
  /** ユーザーに表示する日本語のエラー内容 */
  message: string;
  /** ユーザーが取るべき対応（無い場合はnull） */
  hint: string | null;
};
