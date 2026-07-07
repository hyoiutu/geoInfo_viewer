import polyline from '@mapbox/polyline';
import type { StravaActivity } from '../strava/types/strava-activity.type';
import type { CyclingActivityDto } from './types/cycling-activity.dto';

const EMPTY_POLYLINE = '';

const decodePolylineToPath = (summaryPolyline: string): [number, number][] | null => {
  if (summaryPolyline === EMPTY_POLYLINE) {
    return null;
  }

  return polyline.decode(summaryPolyline).map(([latitude, longitude]) => [longitude, latitude]);
};

export const toCyclingActivityDto = (activity: StravaActivity): CyclingActivityDto => ({
  id: activity.id,
  name: activity.name,
  distanceMeters: activity.distance,
  movingTimeSeconds: activity.moving_time,
  startDate: activity.start_date,
  path: decodePolylineToPath(activity.map.summary_polyline)
});
