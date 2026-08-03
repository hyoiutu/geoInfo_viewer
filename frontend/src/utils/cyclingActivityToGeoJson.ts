import type { Feature, FeatureCollection, MultiLineString } from 'geojson';
import type { CyclingActivity } from '../api/activitiesApi';

/**
 * 自転車ログ一覧のうち、指定した軌跡フィールド（path・summaryPath）を持つものだけをMapLibreの地図に
 * 描画できるGeoJSON形式に変換する共通処理。軌跡を持たないアクティビティは除外する。
 * 軌跡は位置飛び（トンネル内・フェリー乗船中等の測定不能区間）で区間分割された座標配列の配列のため、
 * MultiLineStringとして描画する
 * @param activities 変換元の自転車ログ一覧
 * @param selectPath 変換に使う軌跡フィールドを選択する関数
 * @returns 地図描画用のGeoJSON FeatureCollection
 */
const toGeoJson = (
  activities: CyclingActivity[],
  selectPath: (activity: CyclingActivity) => [number, number][][] | null
): FeatureCollection<MultiLineString> => ({
  type: 'FeatureCollection',
  features: activities.flatMap((activity): Feature<MultiLineString>[] => {
    const path = selectPath(activity);
    if (path === null) {
      return [];
    }
    return [
      {
        type: 'Feature',
        properties: { id: activity.id, name: activity.name },
        geometry: { type: 'MultiLineString', coordinates: path }
      }
    ];
  })
});

/**
 * 自転車ログ一覧を、高解像度の軌跡（path）を使ってMapLibreの地図に描画できるGeoJSON形式に変換する。
 * 軌跡を持たないアクティビティ（GPSルートの無い手動記録等）は除外する
 * @param activities 変換元の自転車ログ一覧
 * @returns 地図描画用のGeoJSON FeatureCollection
 */
export const cyclingActivityToGeoJson = (activities: CyclingActivity[]): FeatureCollection<MultiLineString> =>
  toGeoJson(activities, (activity) => activity.path);

/**
 * 自転車ログ一覧を、低ズームレベル（ズームレベル10以下）表示用の簡略化された軌跡（summaryPath）を使って
 * MapLibreの地図に描画できるGeoJSON形式に変換する。軌跡を持たないアクティビティは除外する（Issue #61）
 * @param activities 変換元の自転車ログ一覧
 * @returns 地図描画用のGeoJSON FeatureCollection
 */
export const cyclingActivitySummaryToGeoJson = (activities: CyclingActivity[]): FeatureCollection<MultiLineString> =>
  toGeoJson(activities, (activity) => activity.summaryPath);
