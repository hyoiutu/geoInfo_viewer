import type maplibregl from 'maplibre-gl';
import { type RefObject, useEffect } from 'react';
import type { CyclingActivity } from '../api/activitiesApi';
import { applySelectionLayers } from '../utils/mapLayerInteraction';

/**
 * 選択中・フォーカス中のアクティビティが変化するたびに、選択用・フォーカス用レイヤーのデータを更新するフック
 * （Issue #127、MapView.tsxから切り出し）
 * @param mapRef 地図インスタンスへのref（useMapInstanceが返すもの）
 * @param selectedActivities 選択中のアクティビティ一覧
 * @param focusedActivity フォーカス中のアクティビティ。未フォーカスの場合はnull
 * @param isStyleLoaded スタイル読み込みが完了したかどうか
 */
export const useSelectionLayerSync = (
  mapRef: RefObject<maplibregl.Map | null>,
  selectedActivities: CyclingActivity[],
  focusedActivity: CyclingActivity | null,
  isStyleLoaded: boolean
): void => {
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isStyleLoaded) {
      return;
    }

    applySelectionLayers(map, selectedActivities, focusedActivity);
  }, [mapRef, selectedActivities, focusedActivity, isStyleLoaded]);
};
