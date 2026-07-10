import type { Feature, FeatureCollection, LineString } from 'geojson';
import type { CyclingActivity } from '../api/activitiesApi';

export const cyclingActivityToGeoJson = (activities: CyclingActivity[]): FeatureCollection<LineString> => ({
  type: 'FeatureCollection',
  features: activities
    .filter((activity): activity is CyclingActivity & { path: [number, number][] } => activity.path !== null)
    .map(
      (activity): Feature<LineString> => ({
        type: 'Feature',
        properties: { id: activity.id, name: activity.name },
        geometry: { type: 'LineString', coordinates: activity.path }
      })
    )
});
