import type maplibregl from 'maplibre-gl';
import { type RefObject, useEffect, useRef } from 'react';
import type { CyclingActivity, PassedMunicipality } from '../api/activitiesApi';
import { registerAdminBoundaryClickHandler } from '../utils/mapLayerInteraction';

/**
 * 地図上の行政区画をクリックしたときの自治体検出を登録するフック。
 * ハンドラの登録はスタイル読み込み完了後（`isStyleLoaded`がtrueになった瞬間）に一度だけ行う（Issue #127、
 * MapView.tsxのマウント時effectから切り出し）
 * @param mapRef 地図インスタンスへのref（useMapInstanceが返すもの）
 * @param isStyleLoaded スタイル読み込みが完了したかどうか
 * @param onFocusMunicipality クリックで自治体が検出されたときに呼ばれるコールバック
 * @param focusedActivity フォーカス中のアクティビティ。未フォーカスの場合はnull（アクティビティフォーカス中は
 * 行政区画クリック検出を無効化するため参照する）
 */
export const useAdminBoundaryClickInteraction = (
  mapRef: RefObject<maplibregl.Map | null>,
  isStyleLoaded: boolean,
  onFocusMunicipality: (municipality: PassedMunicipality) => void,
  focusedActivity: CyclingActivity | null
): void => {
  const onFocusMunicipalityRef = useRef(onFocusMunicipality);
  onFocusMunicipalityRef.current = onFocusMunicipality;
  const focusedActivityRef = useRef(focusedActivity);
  focusedActivityRef.current = focusedActivity;

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isStyleLoaded) {
      return;
    }

    registerAdminBoundaryClickHandler(
      map,
      (municipality) => onFocusMunicipalityRef.current(municipality),
      () => focusedActivityRef.current !== null
    );
  }, [mapRef, isStyleLoaded]);
};
