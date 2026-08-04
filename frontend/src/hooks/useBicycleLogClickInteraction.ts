import type maplibregl from 'maplibre-gl';
import { type RefObject, useEffect, useRef } from 'react';
import type { CyclingActivity } from '../api/activitiesApi';
import { registerBicycleLogClickHandler } from '../utils/mapLayerInteraction';

/**
 * 地図上の自転車ログをクリックしたときのアクティビティ選択検出を登録するフック。
 * ハンドラの登録はスタイル読み込み完了後（`isStyleLoaded`がtrueになった瞬間）に一度だけ行う（Issue #127、
 * MapView.tsxのマウント時effectから切り出し）
 * @param mapRef 地図インスタンスへのref（useMapInstanceが返すもの）
 * @param isStyleLoaded スタイル読み込みが完了したかどうか
 * @param onSelectActivities クリックでアクティビティが検出されたときに呼ばれるコールバック
 * @param focusedActivity フォーカス中のアクティビティ。未フォーカスの場合はnull（フォーカス中はクリック検出を無効化するため参照する）
 */
export const useBicycleLogClickInteraction = (
  mapRef: RefObject<maplibregl.Map | null>,
  isStyleLoaded: boolean,
  onSelectActivities: (ids: string[]) => void,
  focusedActivity: CyclingActivity | null
): void => {
  // クリックハンドラはマウント時に一度だけ登録するため、最新の値をrefで参照する（クロージャの陳腐化対策）
  const onSelectActivitiesRef = useRef(onSelectActivities);
  onSelectActivitiesRef.current = onSelectActivities;
  const focusedActivityRef = useRef(focusedActivity);
  focusedActivityRef.current = focusedActivity;

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isStyleLoaded) {
      return;
    }

    registerBicycleLogClickHandler(
      map,
      (ids) => onSelectActivitiesRef.current(ids),
      () => focusedActivityRef.current !== null
    );
  }, [mapRef, isStyleLoaded]);
};
