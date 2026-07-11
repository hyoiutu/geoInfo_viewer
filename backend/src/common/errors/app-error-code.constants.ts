/** AppErrorInfoのerrorCodeとして使う値の一覧 */
export const APP_ERROR_CODE = {
  stravaAuthFailed: 'STRAVA_AUTH_FAILED',
  stravaRateLimited: 'STRAVA_RATE_LIMITED',
  stravaApiError: 'STRAVA_API_ERROR',
  internalError: 'INTERNAL_ERROR'
} as const;

/** エラー種別を表す識別子 */
export type AppErrorCode = (typeof APP_ERROR_CODE)[keyof typeof APP_ERROR_CODE];
