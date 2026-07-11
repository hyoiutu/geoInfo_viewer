// バックエンドの全エンドポイントが共通で返すエラーレスポンス形式(backend/src/common/errors/app-error-info.type.tsと対応)。
export type AppErrorCode = 'STRAVA_AUTH_FAILED' | 'STRAVA_RATE_LIMITED' | 'STRAVA_API_ERROR' | 'INTERNAL_ERROR';

export type AppErrorInfo = {
  errorCode: AppErrorCode;
  message: string;
  hint: string | null;
};
