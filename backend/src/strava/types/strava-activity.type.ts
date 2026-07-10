// biome-ignore-all lint/style/useNamingConvention: Strava APIのレスポンス形式(snake_case)にそのまま合わせるための型定義
export type StravaActivity = {
  id: number;
  name: string;
  type: string;
  distance: number;
  moving_time: number;
  start_date: string;
  map: {
    summary_polyline: string;
  };
};

// GET /activities/{id}（詳細取得API）のレスポンス。一覧APIには無い高解像度の`polyline`を含む。
// `polyline`はGPSトラックの無い手動記録アクティビティ等では空文字になることがある。
export type StravaActivityDetail = {
  id: number;
  name: string;
  type: string;
  distance: number;
  moving_time: number;
  start_date: string;
  map: {
    summary_polyline: string;
    polyline: string;
  };
};

export type StravaTokenResponse = {
  access_token: string;
  expires_at: number;
};
