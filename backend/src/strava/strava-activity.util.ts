import { CYCLING_ACTIVITY_TYPES } from './strava.constants';
import type { StravaActivity } from './types/strava-activity.type';

export const isCyclingActivity = (activity: StravaActivity): boolean =>
  (CYCLING_ACTIVITY_TYPES as readonly string[]).includes(activity.type);
