import type { CyclingActivity } from '../api/activitiesApi';

const METERS_PER_KILOMETER = 1000;
const SECONDS_PER_HOUR = 3600;
const ZERO_SPEED_KMH = 0;

/**
 * 平均時速(km/h)を算出する。走行時間が0の場合はゼロ除算を避け0を返す
 * @param activity 対象のアクティビティ
 * @returns 平均時速(km/h)
 */
export const calculateAverageSpeedKmh = (activity: CyclingActivity): number => {
  if (activity.movingTimeSeconds === ZERO_SPEED_KMH) {
    return ZERO_SPEED_KMH;
  }
  return (activity.distanceMeters / METERS_PER_KILOMETER / activity.movingTimeSeconds) * SECONDS_PER_HOUR;
};
