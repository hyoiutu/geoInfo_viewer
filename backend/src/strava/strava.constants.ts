export const STRAVA_API_BASE_URL = 'https://www.strava.com/api/v3';
export const STRAVA_ACTIVITIES_PATH = '/athlete/activities';
export const STRAVA_ACTIVITY_DETAIL_PATH = (activityId: number): string => `/activities/${activityId}`;
export const STRAVA_OAUTH_TOKEN_URL = 'https://www.strava.com/oauth/token';
export const STRAVA_GRANT_TYPE_REFRESH_TOKEN = 'refresh_token';
export const TOKEN_EXPIRY_BUFFER_SECONDS = 300;
export const CYCLING_ACTIVITY_TYPES = ['Ride', 'VirtualRide'] as const;
export const STRAVA_MAX_PER_PAGE = 200;

// Stravaの非アップロード系エンドポイントのデフォルトレート制限（15分あたり100リクエスト）。
// https://developers.strava.com/docs/rate-limits/
export const STRAVA_NON_UPLOAD_RATE_LIMIT_PER_WINDOW = 100;
export const STRAVA_NON_UPLOAD_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
