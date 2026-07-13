import type { CyclingActivity } from '../api/activitiesApi';
import { calculateAverageSpeedKmh } from './averageSpeed';

const METERS_PER_KILOMETER = 1000;
const MILLISECONDS_PER_SECOND = 1000;
const DECIMAL_PLACES = 1;
const LOCALE_JA = 'ja-JP';

/** toActivityDetailViewの戻り値（右サイドバーの詳細表示にそのまま使える整形済み文字列） */
type ActivityDetailView = {
  /** アクティビティ名 */
  name: string;
  /** 走行距離（km単位・小数第1位） */
  distanceKm: string;
  /** 獲得標高（m単位・整数） */
  elevationGainMeters: string;
  /** 走行開始日時（ロケール表示形式） */
  startDate: string;
  /** 走行終了日時（開始日時+経過時間から算出、ロケール表示形式） */
  endDate: string;
  /** 平均時速（走行距離÷走行時間から算出、km/h単位・小数第1位） */
  averageSpeedKmh: string;
};

/**
 * アクティビティを、右サイドバーの詳細表示にそのまま使える整形済み文字列へ変換する
 * @param activity 変換元のアクティビティ
 * @returns 整形済みの詳細表示用データ
 */
export const toActivityDetailView = (activity: CyclingActivity): ActivityDetailView => {
  const distanceKm = activity.distanceMeters / METERS_PER_KILOMETER;
  const averageSpeedKmh = calculateAverageSpeedKmh(activity);
  const startDate = new Date(activity.startDate);
  const endDate = new Date(startDate.getTime() + activity.elapsedTimeSeconds * MILLISECONDS_PER_SECOND);

  return {
    name: activity.name,
    distanceKm: `${distanceKm.toFixed(DECIMAL_PLACES)} km`,
    elevationGainMeters: `${Math.round(activity.elevationGainMeters)} m`,
    startDate: startDate.toLocaleString(LOCALE_JA),
    endDate: endDate.toLocaleString(LOCALE_JA),
    averageSpeedKmh: `${averageSpeedKmh.toFixed(DECIMAL_PLACES)} km/h`
  };
};
