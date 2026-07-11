/** フロントエンドへ返す自転車ログ（アクティビティ）1件分 */
export type CyclingActivityDto = {
  /** StravaのアクティビティID */
  id: string;
  /** アクティビティ名 */
  name: string;
  /** 走行距離（メートル） */
  distanceMeters: number;
  /** 走行時間（秒） */
  movingTimeSeconds: number;
  /** 開始日時（ISO 8601形式の文字列） */
  startDate: string;
  /** 軌跡（経度・緯度の配列）。GPSルートの無いアクティビティの場合はnull */
  path: [number, number][] | null;
};
