import type { FeatureCollection } from 'geojson';
import { useSetAtom } from 'jotai';
import type maplibregl from 'maplibre-gl';
import { type RefObject, useEffect, useRef } from 'react';
import type { PassedMunicipality } from '../api/activitiesApi';
import { addErrorAtom } from '../atoms/errorsAtom';
import type { MunicipalityEra } from '../types/municipalityEra';
import { toAppErrorInfo } from '../utils/apiError';
import { applyFocusedMunicipalityLayer, panToMunicipalityCentroid } from '../utils/mapLayerInteraction';
import { applyAdminBoundaryData, getOrFetchMunicipalityBoundaries } from '../utils/mapLayerSetup';

/**
 * 選択中の行政区画年代・フォーカス中の自治体に応じた境界データの取得・地図への反映を担うフック
 * （Issue #127、MapView.tsxから切り出し）。以下の2つの独立したeffectを、`historicalBoundariesCacheRef`
 * （年代ごとのGeoJSONキャッシュ）を共有するため1つのフックにまとめている。
 * - 年代が変化するたびに、境界データ(hit-test用含む)を取得・反映する
 * - フォーカス中の自治体が変化するたびに、フォーカス用オーバーレイのデータを更新し、地図の中心を
 *   フォーカスした行政区画の重心へ合わせる（フォーカス対象は年代の取得・反映とは独立して変化しうるため
 *   依存配列を分けている。クリックのたびに全国分のジオメトリをsetDataし直すと重くなるため。Issue #80フォローアップ）
 * @param mapRef 地図インスタンスへのref（useMapInstanceが返すもの）
 * @param adminBoundaryEra 表示する行政区画の年代
 * @param focusedMunicipality フォーカス中の自治体。未フォーカスの場合はnull
 * @param isStyleLoaded スタイル読み込みが完了したかどうか
 * @param onAdminBoundaryDataApplied 年代変化に伴う境界データの取得・反映が完了した時点（成功・失敗問わず）で
 * 呼ばれるコールバック（Issue #65）
 */
export const useAdminBoundaryData = (
  mapRef: RefObject<maplibregl.Map | null>,
  adminBoundaryEra: MunicipalityEra,
  focusedMunicipality: PassedMunicipality | null,
  isStyleLoaded: boolean,
  onAdminBoundaryDataApplied?: () => void
): void => {
  const historicalBoundariesCacheRef = useRef<Map<MunicipalityEra, FeatureCollection>>(new Map());
  // 依存配列に含めてeffectを不要に再実行しないよう、最新の値をrefで参照する
  const onAdminBoundaryDataAppliedRef = useRef(onAdminBoundaryDataApplied);
  onAdminBoundaryDataAppliedRef.current = onAdminBoundaryDataApplied;
  const addError = useSetAtom(addErrorAtom);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isStyleLoaded) {
      return;
    }

    void applyAdminBoundaryData(map, adminBoundaryEra, historicalBoundariesCacheRef.current)
      .catch((error: unknown) => {
        addError(toAppErrorInfo(error));
      })
      .finally(() => {
        onAdminBoundaryDataAppliedRef.current?.();
      });
  }, [mapRef, adminBoundaryEra, isStyleLoaded, addError]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isStyleLoaded) {
      return;
    }

    void getOrFetchMunicipalityBoundaries(adminBoundaryEra, historicalBoundariesCacheRef.current)
      .then((featureCollection) => {
        const feature = applyFocusedMunicipalityLayer(map, featureCollection, focusedMunicipality);
        if (feature) {
          panToMunicipalityCentroid(map, feature);
        }
      })
      .catch((error: unknown) => {
        addError(toAppErrorInfo(error));
      });
  }, [mapRef, focusedMunicipality, adminBoundaryEra, isStyleLoaded, addError]);
};
