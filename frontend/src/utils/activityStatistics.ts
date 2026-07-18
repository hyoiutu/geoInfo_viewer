import type { CyclingActivity } from '../api/activitiesApi';

const METERS_PER_KILOMETER = 1000;
const DECIMAL_PLACES = 1;

/** toActivityStatisticsViewの戻り値（統計ダイアログの表示にそのまま使える整形済み文字列） */
type ActivityStatisticsView = {
  /** 全アクティビティ数 */
  totalCount: number;
  /** 全アクティビティの総走行距離（km単位・小数第1位） */
  totalDistanceKm: string;
};

/**
 * 全アクティビティ一覧を、統計ダイアログの表示にそのまま使える整形済み文字列へ変換する
 * @param activities 集計対象の全アクティビティ一覧
 * @returns 整形済みの統計表示用データ
 */
export const toActivityStatisticsView = (activities: CyclingActivity[]): ActivityStatisticsView => {
  const totalDistanceMeters = activities.reduce((sum, activity) => sum + activity.distanceMeters, 0);
  const totalDistanceKm = totalDistanceMeters / METERS_PER_KILOMETER;

  return {
    totalCount: activities.length,
    totalDistanceKm: `${totalDistanceKm.toFixed(DECIMAL_PLACES)} km`
  };
};
