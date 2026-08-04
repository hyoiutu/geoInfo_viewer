import maplibregl from 'maplibre-gl';
import { type RefObject, useEffect, useRef } from 'react';
import type { CyclingActivity } from '../api/activitiesApi';
import { registerFocusedActivityHoverHandler } from '../utils/mapLayerInteraction';
import { getReadyMap } from '../utils/mapReady';

const METERS_PER_KILOMETER = 1000;
const HOVER_DISTANCE_DECIMAL_PLACES = 1;

/**
 * フォーカス中のアクティビティの線上をマウスオーバーしたとき、始点からの距離を吹き出し表示するフック（Issue #77）。
 * ハンドラの登録はスタイル読み込み完了後（`isStyleLoaded`がtrueになった瞬間）に一度だけ行う（Issue #127、
 * MapView.tsxのマウント時effectから切り出し）
 * @param mapRef 地図インスタンスへのref（useMapInstanceが返すもの）
 * @param isStyleLoaded スタイル読み込みが完了したかどうか
 * @param focusedActivity フォーカス中のアクティビティ。未フォーカスの場合はnull
 */
export const useFocusedActivityHover = (
  mapRef: RefObject<maplibregl.Map | null>,
  isStyleLoaded: boolean,
  focusedActivity: CyclingActivity | null
): void => {
  const focusedActivityRef = useRef(focusedActivity);
  focusedActivityRef.current = focusedActivity;
  const hoverPopupRef = useRef<maplibregl.Popup | null>(null);

  useEffect(() => {
    const map = getReadyMap(mapRef, isStyleLoaded);
    if (!map) {
      return;
    }

    registerFocusedActivityHoverHandler(
      map,
      () => focusedActivityRef.current,
      (point, distanceMeters) => {
        const distanceKm = (distanceMeters / METERS_PER_KILOMETER).toFixed(HOVER_DISTANCE_DECIMAL_PLACES);
        if (!hoverPopupRef.current) {
          hoverPopupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, anchor: 'bottom' });
        }
        hoverPopupRef.current.setLngLat(point).setText(`${distanceKm} km地点`).addTo(map);
      },
      () => {
        hoverPopupRef.current?.remove();
      }
    );
  }, [mapRef, isStyleLoaded]);
};
