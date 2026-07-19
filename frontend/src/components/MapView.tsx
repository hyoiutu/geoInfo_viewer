import { Box } from '@chakra-ui/react';
import type { FeatureCollection } from 'geojson';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Root } from 'react-dom/client';
import {
  type CyclingActivity,
  fetchCyclingActivities,
  getBackfillStatus,
  type SyncResult,
  syncCyclingActivities
} from '../api/activitiesApi';
import {
  BICYCLE_LOG_FOCUSED_LAYER_ID,
  BICYCLE_LOG_FOCUSED_SOURCE_ID,
  BICYCLE_LOG_LAYER_ID,
  BICYCLE_LOG_SELECTED_LAYER_ID,
  BICYCLE_LOG_SELECTED_SOURCE_ID,
  BICYCLE_LOG_SOURCE_ID
} from '../constants/bicycleLog';
import { useErrorReporter } from '../hooks/useErrorReporter';
import type { ActivityFilter } from '../types/activityFilter';
import type { AppErrorInfo } from '../types/apiError';
import type { CategorizedLayerIds, LayerVisibility } from '../types/layer';
import type { MunicipalityEra } from '../types/municipalityEra';
import { toAppErrorInfo } from '../utils/apiError';
import { cyclingActivityToGeoJson } from '../utils/cyclingActivityToGeoJson';
import { filterActivities } from '../utils/filterActivities';
import { groupLayerIdsByCategory, resolveStyleLayerIds } from '../utils/mapLayerCategory';
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
  /** 選択中のアクティビティ一覧 */
  selectedActivities: CyclingActivity[];
  /** フォーカス中のアクティビティ。未フォーカスの場合はnull */
  focusedActivity: CyclingActivity | null;
  /** 地図クリックでアクティビティが検出されたときに呼ばれるコールバック */
  onSelectActivities: (ids: string[]) => void;
  /** 自転車ログのデータ取得・更新のたびに、取得済みアクティビティ一覧を渡すコールバック */
  onActivitiesLoaded: (activities: CyclingActivity[]) => void;
  /** 地図に表示するアクティビティを絞り込むフィルタ条件 */
  filter: ActivityFilter;
  /** 表示する行政区画の年代 */
  adminBoundaryEra: MunicipalityEra;
};

/**
 * Strava上の新規アクティビティを取得し、取得したアクティビティ一覧をコールバックで通知する。
 * 地図への反映（フィルタ適用後のGeoJSON設定）はこの関数の呼び出し元が別途行う
 * @param onError API呼び出し失敗時に呼ばれるコールバック
 * @param onActivitiesLoaded 取得に成功したアクティビティ一覧を渡すコールバック
 */
const syncAndLoadBicycleLog = async (
  onError: (error: AppErrorInfo) => void,
  onActivitiesLoaded: (activities: CyclingActivity[]) => void
) => {
  // バックフィル実行中は新規アクティビティ取得を呼ばず、その時点でDBに取得済みの分だけ表示する
  const backfillStatus = await getBackfillStatus().catch(() => null);
  if (!backfillStatus?.isRunning) {
    let syncResult: SyncResult;
    try {
      syncResult = await syncCyclingActivities();
    } catch (error) {
      onError(toAppErrorInfo(error));
      return;
    }
    // success:falseはバックエンド側の「バックフィル実行中ガード」を踏んだ場合のみ返る（レースコンディション）。
    // エラーではないため、静かに（ダイアログ無しで）参照APIの呼び出しをスキップする
    if (!syncResult.success) {
      return;
    }
  }

  try {
    const activities = await fetchCyclingActivities();
    onActivitiesLoaded(activities);
  } catch (error) {
    onError(toAppErrorInfo(error));
  }
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
 * selectedActivitiesの並び順（通し番号の昇順）をそのままfeatures配列の並びとして使う。MapLibreは
 * 単一ソース内で後の要素ほど手前に描画するため、これにより「通し番号が大きいものほど手前」というdraw順が実現される
 * @param map 反映先のMapLibre地図インスタンス
 * @param selectedActivities 選択中のアクティビティ一覧（通し番号の昇順）
 * @param focusedActivity フォーカス中のアクティビティ。未フォーカスの場合はnull
 */
const applySelectionLayers = (
  map: maplibregl.Map,
  selectedActivities: CyclingActivity[],
  focusedActivity: CyclingActivity | null
) => {
  const selectedSource = map.getSource<maplibregl.GeoJSONSource>(BICYCLE_LOG_SELECTED_SOURCE_ID);
  const focusedSource = map.getSource<maplibregl.GeoJSONSource>(BICYCLE_LOG_FOCUSED_SOURCE_ID);
  if (!selectedSource || !focusedSource) {
    return;
  }
  const selectedExcludingFocused = selectedActivities.filter((activity) => activity.id !== focusedActivity?.id);
  selectedSource.setData(cyclingActivityToGeoJson(selectedExcludingFocused));
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
};

/** MapLibreの地図本体を表示し、レイヤーの表示/非表示・自転車ログの新規アクティビティ取得・選択状態の描画を行うコンポーネント */
export const MapView = ({
  layerVisibility,
  selectedActivities,
  focusedActivity,
  onSelectActivities,
  onActivitiesLoaded,
  filter,
  adminBoundaryEra
}: MapViewProps) => {
  const addError = useErrorReporter();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const categorizedLayerIdsRef = useRef<CategorizedLayerIds | null>(null);
  const wasBicycleLogVisibleRef = useRef(false);
  const startGoalMarkersRef = useRef<StartGoalMarkerEntry[]>([]);
  const historicalBoundariesCacheRef = useRef<Map<MunicipalityEra, FeatureCollection>>(new Map());
  const [isStyleLoaded, setIsStyleLoaded] = useState(false);
  const [activities, setActivities] = useState<CyclingActivity[]>([]);
  const filteredActivities = useMemo(() => filterActivities(activities, filter), [activities, filter]);
  // クリックハンドラはマウント時に一度だけ登録するため、最新の値をrefで参照する（クロージャの陳腐化対策）
  const onSelectActivitiesRef = useRef(onSelectActivities);
  onSelectActivitiesRef.current = onSelectActivities;
  const focusedActivityRef = useRef(focusedActivity);
  focusedActivityRef.current = focusedActivity;

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
        () => focusedActivityRef.current !== null
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

  // layerVisibility・選択中の行政区画年代が変化するたびに各レイヤーの表示/非表示を反映し、
  // 自転車ログレイヤーがOFF→ONに変化した場合はStrava新規アクティビティ取得・データ取得を行う
  useEffect(() => {
    const map = mapRef.current;
    const categorizedLayerIds = categorizedLayerIdsRef.current;
    if (!map || !isStyleLoaded || !categorizedLayerIds) {
      return;
    }

    applyLayerVisibility(map, categorizedLayerIds, layerVisibility, adminBoundaryEra);

    const isBicycleLogVisible = layerVisibility['bicycle-log'];
    const wasBicycleLogVisible = wasBicycleLogVisibleRef.current;
    wasBicycleLogVisibleRef.current = isBicycleLogVisible;

    if (!wasBicycleLogVisible && isBicycleLogVisible) {
      void syncAndLoadBicycleLog(addError, (loaded) => {
        setActivities(loaded);
        onActivitiesLoaded(loaded);
      });
    }
  }, [layerVisibility, adminBoundaryEra, isStyleLoaded, addError, onActivitiesLoaded]);

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
