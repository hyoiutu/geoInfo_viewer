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

export type StravaTokenResponse = {
  access_token: string;
  expires_at: number;
};
