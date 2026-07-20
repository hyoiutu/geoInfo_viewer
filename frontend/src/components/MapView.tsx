import { Box } from '@chakra-ui/react';
import type { FeatureCollection } from 'geojson';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState } from 'react';
import type { CyclingActivity, PassedMunicipality } from '../api/activitiesApi';
import { BICYCLE_LOG_SOURCE_ID } from '../constants/bicycleLog';
import { useErrorReporter } from '../hooks/useErrorReporter';
import type { CategorizedLayerIds, LayerVisibility } from '../types/layer';
import type { MunicipalityEra } from '../types/municipalityEra';
import { toAppErrorInfo } from '../utils/apiError';
import { cyclingActivityToGeoJson } from '../utils/cyclingActivityToGeoJson';
import { groupLayerIdsByCategory } from '../utils/mapLayerCategory';
import {
  applyFocusedMunicipalityLayer,
  applyLayerVisibility,
  applySelectionLayers,
  applyStartGoalMarkers,
  registerAdminBoundaryClickHandler,
  registerBicycleLogClickHandler,
  registerFocusedActivityHoverHandler,
  type StartGoalMarkerEntry
} from '../utils/mapLayerInteraction';
import {
  addAdminBoundaryFocusLayer,
  addAdminBoundaryHistoricalLayer,
  addAdminBoundaryLayer,
  addAerialPhotoLayer,
  addBicycleLogLayer,
  applyAdminBoundaryData
} from '../utils/mapLayerSetup';

const OSM_VECTOR_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const DEFAULT_ZOOM = 12;
const DEFAULT_CENTER: [number, number] = [139.1798829, 35.2756364];
const EMPTY_FEATURE_COLLECTION: FeatureCollection = { type: 'FeatureCollection', features: [] };
const METERS_PER_KILOMETER = 1000;
const HOVER_DISTANCE_DECIMAL_PLACES = 1;

/** MapViewのprops */
type MapViewProps = {
  /** レイヤーIDごとの表示/非表示状態 */
  layerVisibility: LayerVisibility;
  /** 選択中のアクティビティ一覧 */
  selectedActivities: CyclingActivity[];
  /** フォーカス中のアクティビティ。未フォーカスの場合はnull */
  focusedActivity: CyclingActivity | null;
  /** 地図クリックでアクティビティが検出されたときに呼ばれるコールバック */
  onSelectActivities: (ids: string[]) => void;
  /** 地図に描画するアクティビティ一覧（フィルタ適用済み） */
  filteredActivities: CyclingActivity[];
  /** 表示する行政区画の年代 */
  adminBoundaryEra: MunicipalityEra;
  /** フォーカス中の自治体（地図クリック・通過自治体リストのクリックいずれか）。未フォーカスの場合はnull */
  focusedMunicipality: PassedMunicipality | null;
  /** 行政区画クリックで自治体が検出されたときに呼ばれるコールバック */
  onFocusMunicipality: (municipality: PassedMunicipality) => void;
};

/**
 * MapLibreの地図本体を表示するコンポーネント。「地図インスタンスの生成・破棄」「渡された表示状態
 * （レイヤー可視性・フィルタ済みアクティビティ・選択/フォーカス）を地図に反映する」「クリックによる選択検出」に
 * 責務を絞る。自転車ログの新規アクティビティ取得（Strava同期）は`useCyclingActivities`（呼び出し元が使用）が担う（Issue #58）。
 * クリック検出・選択レイヤー反映・スタートゴールマーカー・レイヤー可視性反映といった地図操作の純粋関数自体は
 * `mapLayerInteraction.ts`へ切り出しており、このファイルにはReactのライフサイクルとの接続のみを置く（PR #71レビュー対応）
 */
export const MapView = ({
  layerVisibility,
  selectedActivities,
  focusedActivity,
  onSelectActivities,
  filteredActivities,
  adminBoundaryEra,
  focusedMunicipality,
  onFocusMunicipality
}: MapViewProps) => {
  const [isStyleLoaded, setIsStyleLoaded] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const categorizedLayerIdsRef = useRef<CategorizedLayerIds | null>(null);
  const startGoalMarkersRef = useRef<StartGoalMarkerEntry[]>([]);
  const historicalBoundariesCacheRef = useRef<Map<MunicipalityEra, FeatureCollection>>(new Map());
  const hoverPopupRef = useRef<maplibregl.Popup | null>(null);
  // クリックハンドラはマウント時に一度だけ登録するため、最新の値をrefで参照する（クロージャの陳腐化対策）
  const onSelectActivitiesRef = useRef(onSelectActivities);
  onSelectActivitiesRef.current = onSelectActivities;
  const focusedActivityRef = useRef(focusedActivity);
  focusedActivityRef.current = focusedActivity;
  const onFocusMunicipalityRef = useRef(onFocusMunicipality);
  onFocusMunicipalityRef.current = onFocusMunicipality;

  const addError = useErrorReporter();

  // マウント時に一度だけMapLibreの地図を生成し、スタイル読み込み完了後に航空写真・自転車ログレイヤーを追加する
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
      registerBicycleLogClickHandler(
        map,
        (ids) => onSelectActivitiesRef.current(ids),
        () => focusedActivityRef.current !== null
      );
      registerAdminBoundaryClickHandler(map, (municipality) => onFocusMunicipalityRef.current(municipality));
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
      setIsStyleLoaded(true);
    });

    return () => {
      mapRef.current = null;
      map.remove();
    };
  }, []);

  // フィルタ適用後のアクティビティ一覧が変化するたびに、通常状態の自転車ログレイヤーのデータを更新する
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isStyleLoaded) {
      return;
    }

    const source = map.getSource<maplibregl.GeoJSONSource>(BICYCLE_LOG_SOURCE_ID);
    if (!source) {
      return;
    }
    source.setData(cyclingActivityToGeoJson(filteredActivities));
  }, [filteredActivities, isStyleLoaded]);

  // 選択中・フォーカス中のアクティビティが変化するたびに、選択用・フォーカス用レイヤーのデータを更新する
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isStyleLoaded) {
      return;
    }

    applySelectionLayers(map, selectedActivities, focusedActivity);
  }, [selectedActivities, focusedActivity, isStyleLoaded]);

  // フォーカス中のアクティビティが変化するたびに、スタート・ゴールマーカーの表示を更新する
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isStyleLoaded) {
      return;
    }

    applyStartGoalMarkers(map, startGoalMarkersRef, focusedActivity);
  }, [focusedActivity, isStyleLoaded]);

  // layerVisibility・選択中の行政区画年代が変化するたびに各レイヤーの表示/非表示を反映する
  useEffect(() => {
    const map = mapRef.current;
    const categorizedLayerIds = categorizedLayerIdsRef.current;
    if (!map || !isStyleLoaded || !categorizedLayerIds) {
      return;
    }

    applyLayerVisibility(map, categorizedLayerIds, layerVisibility, adminBoundaryEra);
  }, [layerVisibility, adminBoundaryEra, isStyleLoaded]);

  // 選択中の行政区画年代・フォーカス中の自治体が変化するたびに、境界データ(hit-test用含む)を取得・反映した上で、
  // フォーカス用オーバーレイのデータを更新する（Issue #76）
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isStyleLoaded) {
      return;
    }

    void applyAdminBoundaryData(map, adminBoundaryEra, historicalBoundariesCacheRef.current)
      .then(() => {
        const featureCollection =
          historicalBoundariesCacheRef.current.get(adminBoundaryEra) ?? EMPTY_FEATURE_COLLECTION;
        applyFocusedMunicipalityLayer(map, featureCollection, focusedMunicipality);
      })
      .catch((error: unknown) => {
        addError(toAppErrorInfo(error));
      });
  }, [adminBoundaryEra, focusedMunicipality, isStyleLoaded, addError]);

  return <Box ref={containerRef} flex="1" minWidth="0" height="100%" data-testid="map-container" />;
};
