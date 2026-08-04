import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { type RefObject, useEffect, useRef, useState } from 'react';
import type { CategorizedLayerIds } from '../types/layer';
import { groupLayerIdsByCategory } from '../utils/mapLayerCategory';
import {
  addAdminBoundaryFocusLayer,
  addAdminBoundaryHistoricalLayer,
  addAdminBoundaryLayer,
  addAerialPhotoLayer,
  addBicycleLogLayer
} from '../utils/mapLayerSetup';

const OSM_VECTOR_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const DEFAULT_ZOOM = 12;
const DEFAULT_CENTER: [number, number] = [139.1798829, 35.2756364];

/** useMapInstanceの戻り値 */
type UseMapInstanceResult = {
  /** MapLibreの地図インスタンス（マウント前・アンマウント後はnull） */
  mapRef: RefObject<maplibregl.Map | null>;
  /** スタイル読み込み・初期レイヤー追加が完了したかどうか */
  isStyleLoaded: boolean;
  /** スタイルレイヤーIDをカテゴリ別に分類した結果（スタイル読み込み完了時に1度だけ設定される） */
  categorizedLayerIdsRef: RefObject<CategorizedLayerIds | null>;
};

/**
 * MapLibreの地図インスタンスの生成・破棄と、初期レイヤー（航空写真・行政区画・自転車ログ）の追加を担うフック。
 * `MapView`の他のフック（useBicycleLogClickInteraction等）はこのフックが返す`mapRef`/`isStyleLoaded`に
 * 依存して動作する（Issue #127、MapView.tsxから切り出し）
 * @param containerRef 地図を描画するDOM要素へのref
 * @returns 地図インスタンス・スタイル読み込み完了フラグ・分類済みレイヤーID
 */
export const useMapInstance = (containerRef: RefObject<HTMLDivElement | null>): UseMapInstanceResult => {
  const [isStyleLoaded, setIsStyleLoaded] = useState(false);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const categorizedLayerIdsRef = useRef<CategorizedLayerIds | null>(null);

  // マウント時に一度だけMapLibreの地図を生成し、スタイル読み込み完了後に初期レイヤーを追加する
  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_VECTOR_STYLE_URL,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      // マップコントロール（地図右下、Issue #32）とライセンス表記が重ならないよう、
      // デフォルトの右下配置ではなく左下へ変更する
      attributionControl: false
    });
    map.addControl(new maplibregl.AttributionControl(), 'bottom-left');
    mapRef.current = map;

    map.once('load', () => {
      const categorizedLayerIds = groupLayerIdsByCategory(map.getStyle().layers ?? []);
      categorizedLayerIdsRef.current = categorizedLayerIds;
      addAerialPhotoLayer(map, categorizedLayerIds);
      addAdminBoundaryLayer(map);
      addAdminBoundaryHistoricalLayer(map);
      addAdminBoundaryFocusLayer(map);
      addBicycleLogLayer(map);
      setIsStyleLoaded(true);
    });

    return () => {
      mapRef.current = null;
      map.remove();
    };
  }, [containerRef]);

  return { mapRef, isStyleLoaded, categorizedLayerIdsRef };
};
