import { Box } from '@chakra-ui/react';
import type { FeatureCollection } from 'geojson';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState } from 'react';
import type { Root } from 'react-dom/client';
import type { CyclingActivity } from '../api/activitiesApi';
import {
  BICYCLE_LOG_FOCUSED_LAYER_ID,
  BICYCLE_LOG_FOCUSED_SOURCE_ID,
  BICYCLE_LOG_LAYER_ID,
  BICYCLE_LOG_SELECTED_LAYER_ID,
  BICYCLE_LOG_SELECTED_SOURCE_ID,
  BICYCLE_LOG_SOURCE_ID
} from '../constants/bicycleLog';
import { useErrorReporter } from '../hooks/useErrorReporter';
import type { CategorizedLayerIds, LayerVisibility } from '../types/layer';
import type { MunicipalityEra } from '../types/municipalityEra';
import { toAppErrorInfo } from '../utils/apiError';
import { cyclingActivityToGeoJson } from '../utils/cyclingActivityToGeoJson';
import { findActivityById } from '../utils/findActivityById';
import {
  groupLayerIdsByCategory,
  resolveStyleLayerIds,
  resolveUnusedAdminBoundaryLayerIds
} from '../utils/mapLayerCategory';
import {
  addAdminBoundaryHistoricalLayer,
  addAdminBoundaryLayer,
  addAerialPhotoLayer,
  addBicycleLogLayer,
  applyAdminBoundaryHistoricalData
} from '../utils/mapLayerSetup';
import { createGoalMarkerElement, createStartMarkerElement } from '../utils/startGoalMarkerElement';
import { typedEntries } from '../utils/typedObject';

const OSM_VECTOR_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const DEFAULT_ZOOM = 12;
const DEFAULT_CENTER: [number, number] = [139.1798829, 35.2756364];
const VISIBLE_VALUE = 'visible';
const HIDDEN_VALUE = 'none';
// 自転車ログの線は太さ2〜4pxと細く正確なクリックが難しいため、クリック地点を中心とした
// 10px四方(片側5px)のバウンディングボックスでヒットテストする
const HIT_TEST_RADIUS_PX = 5;

/** MapViewのprops */
type MapViewProps = {
  /** レイヤーIDごとの表示/非表示状態 */
  layerVisibility: LayerVisibility;
  /** 選択中のアクティビティID一覧 */
  selectedIds: string[];
  /** フォーカス中のアクティビティID。未フォーカスの場合はnull */
  focusedId: string | null;
  /** 地図クリックでアクティビティが検出されたときに呼ばれるコールバック */
  onSelectActivities: (ids: string[]) => void;
  /** 地図に描画するアクティビティ一覧（フィルタ適用済み） */
  filteredActivities: CyclingActivity[];
  /** 表示する行政区画の年代 */
  adminBoundaryEra: MunicipalityEra;
};

/**
 * 自転車ログレイヤーのクリックを検出し、選択中アクティビティを置き換える。
 * 線が細く正確なクリックが難しいため、クリック地点を中心としたバウンディングボックスでヒットテストする。
 * フォーカス中はクリックによる選択変更を無効にする
 * @param map クリックを監視するMapLibre地図インスタンス
 * @param onSelectActivities 検出したアクティビティID一覧を渡すコールバック
 * @param isFocused 呼び出し時点でフォーカス中かどうかを返す関数
 */
const registerBicycleLogClickHandler = (
  map: maplibregl.Map,
  onSelectActivities: (ids: string[]) => void,
  isFocused: () => boolean
) => {
  map.on('click', (event) => {
    if (isFocused()) {
      return;
    }

    const bbox: [maplibregl.PointLike, maplibregl.PointLike] = [
      [event.point.x - HIT_TEST_RADIUS_PX, event.point.y - HIT_TEST_RADIUS_PX],
      [event.point.x + HIT_TEST_RADIUS_PX, event.point.y + HIT_TEST_RADIUS_PX]
    ];
    const features = map.queryRenderedFeatures(bbox, {
      layers: [BICYCLE_LOG_LAYER_ID, BICYCLE_LOG_SELECTED_LAYER_ID, BICYCLE_LOG_FOCUSED_LAYER_ID]
    });
    // 同一クリックでも複数の描画フィーチャーが同一アクティビティIDを指しうるため重複排除する
    const ids = [...new Set(features.map((feature) => String(feature.properties?.id)))];
    if (ids.length > 0) {
      onSelectActivities(ids);
    }
  });
};

/**
 * 選択・フォーカス状態を、自転車ログの選択用・フォーカス用レイヤーのGeoJSONデータへ反映する。
 * selectedIdsの並び順（通し番号の昇順）をそのままfeatures配列の並びとして使う。MapLibreは
 * 単一ソース内で後の要素ほど手前に描画するため、これにより「通し番号が大きいものほど手前」というdraw順が実現される
 * @param map 反映先のMapLibre地図インスタンス
 * @param activities 現在地図に描画されているアクティビティ一覧
 * @param selectedIds 選択中のアクティビティID一覧（通し番号の昇順）
 * @param focusedId フォーカス中のアクティビティID。未フォーカスの場合はnull
 */
const applySelectionLayers = (
  map: maplibregl.Map,
  activities: CyclingActivity[],
  selectedIds: string[],
  focusedId: string | null
) => {
  const focusedActivity = findActivityById(activities, focusedId);
  const activityById = new Map(activities.map((activity) => [activity.id, activity]));

  const selectedActivities = selectedIds
    .filter((id) => id !== focusedId)
    .map((id) => activityById.get(id))
    .filter((activity): activity is CyclingActivity => activity !== undefined);

  const selectedSource = map.getSource<maplibregl.GeoJSONSource>(BICYCLE_LOG_SELECTED_SOURCE_ID);
  const focusedSource = map.getSource<maplibregl.GeoJSONSource>(BICYCLE_LOG_FOCUSED_SOURCE_ID);
  if (!selectedSource || !focusedSource) {
    return;
  }
  selectedSource.setData(cyclingActivityToGeoJson(selectedActivities));
  focusedSource.setData(cyclingActivityToGeoJson(focusedActivity ? [focusedActivity] : []));
};

/** スタート・ゴールマーカー1件分の、地図上のMarkerとそのアイコンを描画しているReact rootの組 */
type StartGoalMarkerEntry = {
  /** 地図上のMarkerインスタンス */
  marker: maplibregl.Marker;
  /** マーカーのアイコンをレンダリングしているReact root */
  root: Root;
};

/**
 * フォーカス中のアクティビティの開始地点・終了地点に、スタート・ゴールを示すマーカーを表示する。
 * pathは位置飛び（測定不能区間）で区間分割された座標配列の配列のため、最初の区間の最初の点をスタート、
 * 最後の区間の最後の点をゴールとする。フォーカスが無い場合、または軌跡(path)を持たないアクティビティの場合は
 * マーカーを全て取り除く。開始地点と終了地点が同じ座標の場合（周回ルート等）に手前へ描画されるよう、
 * スタートのマーカーを後から追加する
 * @param map 反映先のMapLibre地図インスタンス
 * @param markersRef 直前に表示していたマーカー・React rootの組を保持するref（今回分の反映前に取り除くために使う）
 * @param focusedActivity フォーカス中のアクティビティ。未フォーカスの場合はnull
 */
const applyStartGoalMarkers = (
  map: maplibregl.Map,
  markersRef: { current: StartGoalMarkerEntry[] },
  focusedActivity: CyclingActivity | null
) => {
  for (const { marker, root } of markersRef.current) {
    marker.remove();
    root.unmount();
  }
  markersRef.current = [];

  const path = focusedActivity?.path;
  const firstSegment = path?.[0];
  const lastSegment = path?.[path.length - 1];
  if (!firstSegment || !lastSegment || firstSegment.length === 0 || lastSegment.length === 0) {
    return;
  }

  const startPoint = firstSegment[0];
  const goalPoint = lastSegment[lastSegment.length - 1];
  const goal = createGoalMarkerElement();
  const goalMarker = new maplibregl.Marker({ element: goal.element }).setLngLat(goalPoint).addTo(map);
  const start = createStartMarkerElement();
  const startMarker = new maplibregl.Marker({ element: start.element }).setLngLat(startPoint).addTo(map);

  markersRef.current = [
    { marker: goalMarker, root: goal.root },
    { marker: startMarker, root: start.root }
  ];
};

/**
 * 現在の表示/非表示状態を、対応するMapLibreスタイルレイヤーへ反映する
 * @param map 反映先のMapLibre地図インスタンス
 * @param categorizedLayerIds カテゴリごとに分類されたスタイルレイヤーIDの一覧
 * @param layerVisibility レイヤーIDごとの表示/非表示状態
 * @param adminBoundaryEra 選択中の行政区画の年代識別子
 */
const applyLayerVisibility = (
  map: maplibregl.Map,
  categorizedLayerIds: CategorizedLayerIds,
  layerVisibility: LayerVisibility,
  adminBoundaryEra: MunicipalityEra
) => {
  const entries = typedEntries(layerVisibility);

  for (const [layerId, isVisible] of entries) {
    const visibility = isVisible ? VISIBLE_VALUE : HIDDEN_VALUE;
    const styleLayerIds = resolveStyleLayerIds(layerId, categorizedLayerIds, adminBoundaryEra);
    for (const styleLayerId of styleLayerIds) {
      map.setLayoutProperty(styleLayerId, 'visibility', visibility);
    }
  }

  // admin-boundaryは選択中の年代（current/過去）によって現行・過去年代いずれかのレイヤー群のみを使うため、
  // 選択されていない方の年代のレイヤー群は行政区画レイヤーのON/OFFに関わらず常に非表示にする（Issue #67）
  const unusedAdminBoundaryLayerIds = resolveUnusedAdminBoundaryLayerIds(categorizedLayerIds, adminBoundaryEra);
  for (const styleLayerId of unusedAdminBoundaryLayerIds) {
    map.setLayoutProperty(styleLayerId, 'visibility', HIDDEN_VALUE);
  }
};

/**
 * MapLibreの地図本体を表示するコンポーネント。「地図インスタンスの生成・破棄」「渡された表示状態
 * （レイヤー可視性・フィルタ済みアクティビティ・選択/フォーカス）を地図に反映する」「クリックによる選択検出」に
 * 責務を絞る。自転車ログの新規アクティビティ取得（Strava同期）は`useCyclingActivities`（呼び出し元が使用）が担う（Issue #58）
 */
export const MapView = ({
  layerVisibility,
  selectedIds,
  focusedId,
  onSelectActivities,
  filteredActivities,
  adminBoundaryEra
}: MapViewProps) => {
  const addError = useErrorReporter();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const categorizedLayerIdsRef = useRef<CategorizedLayerIds | null>(null);
  const startGoalMarkersRef = useRef<StartGoalMarkerEntry[]>([]);
  const historicalBoundariesCacheRef = useRef<Map<MunicipalityEra, FeatureCollection>>(new Map());
  const [isStyleLoaded, setIsStyleLoaded] = useState(false);
  // クリックハンドラはマウント時に一度だけ登録するため、最新の値をrefで参照する（クロージャの陳腐化対策）
  const onSelectActivitiesRef = useRef(onSelectActivities);
  onSelectActivitiesRef.current = onSelectActivities;
  const focusedIdRef = useRef(focusedId);
  focusedIdRef.current = focusedId;

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
      addBicycleLogLayer(map);
      registerBicycleLogClickHandler(
        map,
        (ids) => onSelectActivitiesRef.current(ids),
        () => focusedIdRef.current !== null
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

    applySelectionLayers(map, filteredActivities, selectedIds, focusedId);
  }, [filteredActivities, selectedIds, focusedId, isStyleLoaded]);

  // フォーカス中のアクティビティが変化するたびに、スタート・ゴールマーカーの表示を更新する
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isStyleLoaded) {
      return;
    }

    const focusedActivity = findActivityById(filteredActivities, focusedId);
    applyStartGoalMarkers(map, startGoalMarkersRef, focusedActivity);
  }, [filteredActivities, focusedId, isStyleLoaded]);

  // layerVisibility・選択中の行政区画年代が変化するたびに各レイヤーの表示/非表示を反映する
  useEffect(() => {
    const map = mapRef.current;
    const categorizedLayerIds = categorizedLayerIdsRef.current;
    if (!map || !isStyleLoaded || !categorizedLayerIds) {
      return;
    }

    applyLayerVisibility(map, categorizedLayerIds, layerVisibility, adminBoundaryEra);
  }, [layerVisibility, adminBoundaryEra, isStyleLoaded]);

  // 選択中の行政区画年代が変化するたびに、過去年代用のGeoJSONを取得し反映する（currentの場合は何もしない）
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isStyleLoaded) {
      return;
    }

    void applyAdminBoundaryHistoricalData(map, adminBoundaryEra, historicalBoundariesCacheRef.current).catch(
      (error: unknown) => {
        addError(toAppErrorInfo(error));
      }
    );
  }, [adminBoundaryEra, isStyleLoaded, addError]);

  return <Box ref={containerRef} flex="1" minWidth="0" height="100%" data-testid="map-container" />;
};
