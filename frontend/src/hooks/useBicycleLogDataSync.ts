import type maplibregl from 'maplibre-gl';
import { type RefObject, useEffect } from 'react';
import type { CyclingActivity } from '../api/activitiesApi';
import { BICYCLE_LOG_SOURCE_ID, BICYCLE_LOG_SUMMARY_SOURCE_ID } from '../constants/bicycleLog';
import { cyclingActivitySummaryToGeoJson, cyclingActivityToGeoJson } from '../utils/cyclingActivityToGeoJson';

/**
 * フィルタ適用後のアクティビティ一覧が変化するたびに、通常状態・summary状態（低ズームレベル用、Issue #61）
 * 両方の自転車ログレイヤーのデータを更新するフック（Issue #127、MapView.tsxから切り出し）
 * @param mapRef 地図インスタンスへのref（useMapInstanceが返すもの）
 * @param filteredActivities 地図に描画するアクティビティ一覧（フィルタ適用済み）
 * @param isStyleLoaded スタイル読み込みが完了したかどうか
 */
export const useBicycleLogDataSync = (
  mapRef: RefObject<maplibregl.Map | null>,
  filteredActivities: CyclingActivity[],
  isStyleLoaded: boolean
): void => {
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isStyleLoaded) {
      return;
    }

    const source = map.getSource<maplibregl.GeoJSONSource>(BICYCLE_LOG_SOURCE_ID);
    if (source) {
      source.setData(cyclingActivityToGeoJson(filteredActivities));
    }

    const summarySource = map.getSource<maplibregl.GeoJSONSource>(BICYCLE_LOG_SUMMARY_SOURCE_ID);
    if (summarySource) {
      summarySource.setData(cyclingActivitySummaryToGeoJson(filteredActivities));
    }
  }, [mapRef, filteredActivities, isStyleLoaded]);
};
