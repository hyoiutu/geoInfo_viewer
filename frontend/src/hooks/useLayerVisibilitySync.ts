import type maplibregl from 'maplibre-gl';
import { type RefObject, useEffect } from 'react';
import type { CategorizedLayerIds, LayerVisibility } from '../types/layer';
import type { MunicipalityEra } from '../types/municipalityEra';
import { applyLayerVisibility } from '../utils/mapLayerInteraction';
import { getReadyMap } from '../utils/mapReady';

/**
 * layerVisibility・選択中の行政区画年代が変化するたびに各レイヤーの表示/非表示を反映するフック
 * （Issue #127、MapView.tsxから切り出し）
 * @param mapRef 地図インスタンスへのref（useMapInstanceが返すもの）
 * @param categorizedLayerIdsRef スタイルレイヤーIDをカテゴリ別に分類した結果へのref（useMapInstanceが返すもの）
 * @param layerVisibility レイヤーIDごとの表示/非表示状態
 * @param adminBoundaryEra 表示する行政区画の年代
 * @param isStyleLoaded スタイル読み込みが完了したかどうか
 */
export const useLayerVisibilitySync = (
  mapRef: RefObject<maplibregl.Map | null>,
  categorizedLayerIdsRef: RefObject<CategorizedLayerIds | null>,
  layerVisibility: LayerVisibility,
  adminBoundaryEra: MunicipalityEra,
  isStyleLoaded: boolean
): void => {
  useEffect(() => {
    const map = getReadyMap(mapRef, isStyleLoaded);
    const categorizedLayerIds = categorizedLayerIdsRef.current;
    if (!map || !categorizedLayerIds) {
      return;
    }

    applyLayerVisibility(map, categorizedLayerIds, layerVisibility, adminBoundaryEra);
  }, [mapRef, categorizedLayerIdsRef, layerVisibility, adminBoundaryEra, isStyleLoaded]);
};
