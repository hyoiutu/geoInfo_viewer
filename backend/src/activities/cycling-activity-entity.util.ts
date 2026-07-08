import polyline from '@mapbox/polyline';
import type { StravaActivity } from '../strava/types/strava-activity.type';
import { CyclingActivityEntity } from './entities/cycling-activity.entity';

const EMPTY_POLYLINE = '';

const decodePolylineToPath = (summaryPolyline: string): [number, number][] | null => {
  if (summaryPolyline === EMPTY_POLYLINE) {
    return null;
  }

  return polyline.decode(summaryPolyline).map(([latitude, longitude]) => [longitude, latitude]);
};

export const toCyclingActivityEntity = (activity: StravaActivity): CyclingActivityEntity => {
  const path = decodePolylineToPath(activity.map.summary_polyline);
  const entity = new CyclingActivityEntity();
  entity.id = activity.id;
  entity.name = activity.name;
  entity.distanceMeters = activity.distance;
  entity.movingTimeSeconds = activity.moving_time;
  entity.startDate = new Date(activity.start_date);
  entity.path = path === null ? null : { type: 'LineString', coordinates: path };
  return entity;
};
