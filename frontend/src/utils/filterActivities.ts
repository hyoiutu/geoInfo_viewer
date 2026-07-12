import type { CyclingActivity } from '../api/activitiesApi';
import type { ActivityFilter } from '../types/activityFilter';

const METERS_PER_KILOMETER = 1000;
const SECONDS_PER_HOUR = 3600;
const JANUARY = 1;
const DECEMBER = 12;
const DEFAULT_START_YEAR = 1980;
const MONTH_INDEX_OFFSET = 1;
const NEXT_MONTH_OFFSET = 1;
const FIRST_DAY_OF_MONTH = 1;
const ZERO_SPEED_KMH = 0;

/**
 * フィルタ条件が有効かどうかを検証する。「月のみ入力され年が未入力」の組み合わせは無効とする
 * @param filter 検証対象のフィルタ条件
 * @returns 有効な場合true
 */
export const isActivityFilterValid = (filter: ActivityFilter): boolean => {
  if (filter.startMonth !== null && filter.startYear === null) {
    return false;
  }
  if (filter.endMonth !== null && filter.endYear === null) {
    return false;
  }
  return true;
};

/**
 * 検索範囲の開始年月（月初のDate）を求める。開始・終了とも未入力の場合は日付フィルタ自体を行わないためnullを返す
 * @param filter フィルタ条件
 * @returns 開始年月の月初に対応するDate。日付フィルタが不要な場合はnull
 */
const resolveStartDate = (filter: ActivityFilter): Date | null => {
  if (filter.startYear === null && filter.endYear === null) {
    return null;
  }
  if (filter.startYear === null) {
    return new Date(DEFAULT_START_YEAR, JANUARY - MONTH_INDEX_OFFSET, FIRST_DAY_OF_MONTH);
  }
  const month = filter.startMonth ?? JANUARY;
  return new Date(filter.startYear, month - MONTH_INDEX_OFFSET, FIRST_DAY_OF_MONTH);
};

/**
 * 検索範囲の終了年月の翌月月初（排他的上限）のDateを求める。開始・終了とも未入力の場合は日付フィルタ自体を
 * 行わないためnullを返す
 * @param filter フィルタ条件
 * @param now 現在時刻（検索範囲終了が未入力の場合の基準）
 * @returns 終了年月の翌月月初に対応するDate（この時刻より前かどうかで判定する）。日付フィルタが不要な場合はnull
 */
const resolveEndDateExclusive = (filter: ActivityFilter, now: Date): Date | null => {
  if (filter.startYear === null && filter.endYear === null) {
    return null;
  }
  if (filter.endYear === null) {
    return new Date(now.getFullYear(), now.getMonth() + NEXT_MONTH_OFFSET, FIRST_DAY_OF_MONTH);
  }
  const month = filter.endMonth ?? DECEMBER;
  return new Date(filter.endYear, month - MONTH_INDEX_OFFSET + NEXT_MONTH_OFFSET, FIRST_DAY_OF_MONTH);
};

/**
 * 平均時速(km/h)を算出する。走行時間が0の場合はゼロ除算を避け0を返す
 * @param activity 対象のアクティビティ
 * @returns 平均時速(km/h)
 */
const calculateAverageSpeedKmh = (activity: CyclingActivity): number => {
  if (activity.movingTimeSeconds === ZERO_SPEED_KMH) {
    return ZERO_SPEED_KMH;
  }
  return (activity.distanceMeters / METERS_PER_KILOMETER / activity.movingTimeSeconds) * SECONDS_PER_HOUR;
};

/**
 * アクティビティ一覧をフィルタ条件で絞り込む。各条件はAND（全て満たすもののみ）で組み合わされる
 * @param activities 絞り込み対象のアクティビティ一覧
 * @param filter フィルタ条件
 * @param now 現在時刻（検索範囲終了が未入力の場合の基準。省略時は呼び出し時点の現在時刻）
 * @returns 条件に合致するアクティビティ一覧
 */
export const filterActivities = (
  activities: CyclingActivity[],
  filter: ActivityFilter,
  now: Date = new Date()
): CyclingActivity[] => {
  const startDate = resolveStartDate(filter);
  const endDateExclusive = resolveEndDateExclusive(filter, now);

  return activities.filter((activity) => {
    const activityStartDate = new Date(activity.startDate);
    if (startDate !== null && activityStartDate < startDate) {
      return false;
    }
    if (endDateExclusive !== null && activityStartDate >= endDateExclusive) {
      return false;
    }
    if (filter.minElevationGainMeters !== null && activity.elevationGainMeters < filter.minElevationGainMeters) {
      return false;
    }
    if (filter.minAverageSpeedKmh !== null && calculateAverageSpeedKmh(activity) < filter.minAverageSpeedKmh) {
      return false;
    }
    if (filter.minDistanceKm !== null && activity.distanceMeters / METERS_PER_KILOMETER < filter.minDistanceKm) {
      return false;
    }
    return true;
  });
};
