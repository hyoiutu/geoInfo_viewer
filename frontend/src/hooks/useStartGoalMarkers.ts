import type maplibregl from 'maplibre-gl';
import { type RefObject, useEffect, useRef } from 'react';
import type { CyclingActivity } from '../api/activitiesApi';
import { applyStartGoalMarkers, type StartGoalMarkerEntry } from '../utils/mapLayerInteraction';

/**
 * フォーカス中のアクティビティが変化するたびに、スタート・ゴールマーカーの表示を更新するフック
 * （Issue #127、MapView.tsxから切り出し）
 * @param mapRef 地図インスタンスへのref（useMapInstanceが返すもの）
 * @param focusedActivity フォーカス中のアクティビティ。未フォーカスの場合はnull
 * @param isStyleLoaded スタイル読み込みが完了したかどうか
 */
export const useStartGoalMarkers = (
  mapRef: RefObject<maplibregl.Map | null>,
  focusedActivity: CyclingActivity | null,
  isStyleLoaded: boolean
): void => {
  const startGoalMarkersRef = useRef<StartGoalMarkerEntry[]>([]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isStyleLoaded) {
      return;
    }

    applyStartGoalMarkers(map, startGoalMarkersRef, focusedActivity);
  }, [mapRef, focusedActivity, isStyleLoaded]);
};
