import { CYCLING_ACTIVITY_TYPES } from './strava.constants';
import type { StravaActivity } from './types/strava-activity.type';

/**
 * アクティビティがサイクリング系（Ride・VirtualRide）かどうかを判定する
 * @param activity 判定対象のアクティビティ
 * @returns サイクリング系であればtrue
 */
export const isCyclingActivity = (activity: StravaActivity): boolean =>
  (CYCLING_ACTIVITY_TYPES as readonly string[]).includes(activity.type);
