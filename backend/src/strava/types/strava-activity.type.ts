// biome-ignore-all lint/style/useNamingConvention: Strava APIのレスポンス形式(snake_case)にそのまま合わせるための型定義

/** GET /athlete/activities（一覧取得API）が返すアクティビティ1件分 */
export type StravaActivity = {
  /** StravaのアクティビティID */
  id: number;
  /** アクティビティ名 */
  name: string;
  /** アクティビティ種別（'Ride'・'Run'等） */
  type: string;
  /** 走行距離（メートル） */
  distance: number;
  /** 走行時間（秒） */
  moving_time: number;
  /** 開始日時（ISO 8601形式の文字列） */
  start_date: string;
  /** 経路情報 */
  map: {
    /** 簡略化された（低解像度の）エンコード済みポリライン */
    summary_polyline: string;
  };
};

/**
 * GET /activities/{id}（詳細取得API）のレスポンス。一覧APIには無い高解像度の`polyline`を含む。
 * `polyline`はGPSトラックの無い手動記録アクティビティ等では空文字になることがある。
 */
export type StravaActivityDetail = {
  /** StravaのアクティビティID */
  id: number;
  /** アクティビティ名 */
  name: string;
  /** アクティビティ種別（'Ride'・'Run'等） */
  type: string;
  /** 走行距離（メートル） */
  distance: number;
  /** 走行時間（秒） */
  moving_time: number;
  /** 開始日時（ISO 8601形式の文字列） */
  start_date: string;
  /** 経路情報 */
  map: {
    /** 簡略化された（低解像度の）エンコード済みポリライン */
    summary_polyline: string;
    /** 高解像度のエンコード済みポリライン（GPSトラックが無い場合は空文字） */
    polyline: string;
  };
};

/** POST /oauth/token（トークンリフレッシュAPI）のレスポンス */
export type StravaTokenResponse = {
  /** 新しいアクセストークン */
  access_token: string;
  /** アクセストークンの失効日時（epoch秒） */
  expires_at: number;
};
