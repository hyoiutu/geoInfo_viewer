import type { Feature, FeatureCollection, LineString } from 'geojson';
import type { CyclingActivity } from '../api/activitiesApi';

/**
 * 自転車ログ一覧をMapLibreの地図に描画できるGeoJSON形式に変換する。
 * 軌跡（path）を持たないアクティビティ（GPSルートの無い手動記録等）は除外する
 * @param activities 変換元の自転車ログ一覧
 * @returns 地図描画用のGeoJSON FeatureCollection
 */
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
