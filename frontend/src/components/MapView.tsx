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
  ADMIN_BOUNDARY_MUNICIPALITY_FILTER,
  ADMIN_BOUNDARY_MUNICIPALITY_LAYER_ID,
  ADMIN_BOUNDARY_MUNICIPALITY_LINE_COLOR,
  ADMIN_BOUNDARY_MUNICIPALITY_LINE_DASHARRAY,
  ADMIN_BOUNDARY_MUNICIPALITY_MIN_ZOOM,
  ADMIN_BOUNDARY_MUNICIPALITY_SOURCE_ID,
  ADMIN_BOUNDARY_MUNICIPALITY_SOURCE_LAYER
} from '../constants/adminBoundary';
import {
  AERIAL_PHOTO_ATTRIBUTION,
  AERIAL_PHOTO_LAYER_ID,
  AERIAL_PHOTO_MAX_ZOOM,
  AERIAL_PHOTO_SOURCE_ID,
  AERIAL_PHOTO_TILE_SIZE,
  AERIAL_PHOTO_TILE_URL
} from '../constants/aerialPhoto';
import {
  BICYCLE_LOG_FOCUSED_LAYER_ID,
  BICYCLE_LOG_FOCUSED_OUTLINE_COLOR,
  BICYCLE_LOG_FOCUSED_OUTLINE_LAYER_ID,
  BICYCLE_LOG_FOCUSED_OUTLINE_WIDTH,
  BICYCLE_LOG_FOCUSED_SOURCE_ID,
  BICYCLE_LOG_LAYER_ID,
  BICYCLE_LOG_LINE_COLOR_DEFAULT,
  BICYCLE_LOG_LINE_COLOR_FOCUSED,
  BICYCLE_LOG_LINE_COLOR_SELECTED,
  BICYCLE_LOG_LINE_WIDTH_DEFAULT,
  BICYCLE_LOG_LINE_WIDTH_FOCUSED,
  BICYCLE_LOG_LINE_WIDTH_SELECTED,
  BICYCLE_LOG_SELECTED_LAYER_ID,
  BICYCLE_LOG_SELECTED_SOURCE_ID,
  BICYCLE_LOG_SOURCE_ID
} from '../constants/bicycleLog';
import { useErrorReporter } from '../hooks/useErrorReporter';
import type { ActivityFilter } from '../types/activityFilter';
import type { AppErrorInfo } from '../types/apiError';
import type { LayerVisibility, ToggleableLayerId } from '../types/layer';
import { toAppErrorInfo } from '../utils/apiError';
import { cyclingActivityToGeoJson } from '../utils/cyclingActivityToGeoJson';
import { filterActivities } from '../utils/filterActivities';
import { findActivityById } from '../utils/findActivityById';
import { groupLayerIdsByCategory } from '../utils/mapLayerCategory';
import { createGoalMarkerElement, createStartMarkerElement } from '../utils/startGoalMarkerElement';
import { typedEntries } from '../utils/typedObject';

const OSM_VECTOR_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const DEFAULT_ZOOM = 12;
const DEFAULT_CENTER: [number, number] = [139.1798829, 35.2756364];
const VISIBLE_VALUE = 'visible';
const HIDDEN_VALUE = 'none';
const EMPTY_FEATURE_COLLECTION: FeatureCollection = { type: 'FeatureCollection', features: [] };
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
  /** 自転車ログのデータ取得・更新のたびに、取得済みアクティビティ一覧を渡すコールバック */
  onActivitiesLoaded: (activities: CyclingActivity[]) => void;
  /** 地図に表示するアクティビティを絞り込むフィルタ条件 */
  filter: ActivityFilter;
};

type CategorizedLayerIds = Record<ToggleableLayerId, string[]>;

/**
 * 航空写真のラスタータイルレイヤーを地図に追加する
 * @param map 追加先のMapLibre地図インスタンス
 * @param categorizedLayerIds カテゴリごとに分類されたスタイルレイヤーIDの一覧
 */
const addAerialPhotoLayer = (map: maplibregl.Map, categorizedLayerIds: CategorizedLayerIds) => {
  map.addSource(AERIAL_PHOTO_SOURCE_ID, {
    type: 'raster',
    tiles: [AERIAL_PHOTO_TILE_URL],
    tileSize: AERIAL_PHOTO_TILE_SIZE,
    attribution: AERIAL_PHOTO_ATTRIBUTION,
    maxzoom: AERIAL_PHOTO_MAX_ZOOM
  });

  const beforeId = categorizedLayerIds['osm-road'][0];
  map.addLayer({ id: AERIAL_PHOTO_LAYER_ID, type: 'raster', source: AERIAL_PHOTO_SOURCE_ID }, beforeId);
};

/**
 * 市町村行政区画の境界線レイヤーを地図に追加する。都道府県境界(boundary_3)は既存のOSMベーススタイルに
 * 含まれるため追加不要で、ここでは含まれていない市町村境界(admin_level 7〜8)のみを追加する。
 * 都道府県境界と同じ見た目にするため、そのすぐ手前(=下)に追加する
 * @param map 追加先のMapLibre地図インスタンス
 */
const addAdminBoundaryLayer = (map: maplibregl.Map) => {
  map.addLayer(
    {
      id: ADMIN_BOUNDARY_MUNICIPALITY_LAYER_ID,
      type: 'line',
      source: ADMIN_BOUNDARY_MUNICIPALITY_SOURCE_ID,
      'source-layer': ADMIN_BOUNDARY_MUNICIPALITY_SOURCE_LAYER,
      filter: ADMIN_BOUNDARY_MUNICIPALITY_FILTER,
      minzoom: ADMIN_BOUNDARY_MUNICIPALITY_MIN_ZOOM,
      paint: {
        'line-color': ADMIN_BOUNDARY_MUNICIPALITY_LINE_COLOR,
        'line-dasharray': ADMIN_BOUNDARY_MUNICIPALITY_LINE_DASHARRAY
      }
    },
    'boundary_3'
  );
};

/**
 * 自転車ログ用の空のGeoJSONソース・ラインレイヤーを地図に追加する。
 * 通常状態(全アクティビティ)・選択状態・フォーカス状態をそれぞれ別のソース・レイヤーとして持つ。
 * 単一のline層には描画順を制御する仕組みが無いため、レイヤーを追加した順（=描画順、後から追加した方が手前）で
 * 「通常→選択→フォーカス」の手前関係を実現する。
 * フォーカス状態は他の線に埋もれず視認できるよう、フォーカス用ソースを参照する地図背景色のハロー(縁取り)レイヤーを
 * 色付き本体レイヤーより先に(=下に)追加する
 * @param map 追加先のMapLibre地図インスタンス
 */
const addBicycleLogLayer = (map: maplibregl.Map) => {
  const addLineLayer = (sourceId: string, layerId: string, color: string, width: number) => {
    map.addLayer({
      id: layerId,
      type: 'line',
      source: sourceId,
      paint: { 'line-color': color, 'line-width': width }
    });
  };

  map.addSource(BICYCLE_LOG_SOURCE_ID, { type: 'geojson', data: EMPTY_FEATURE_COLLECTION });
  addLineLayer(
    BICYCLE_LOG_SOURCE_ID,
    BICYCLE_LOG_LAYER_ID,
    BICYCLE_LOG_LINE_COLOR_DEFAULT,
    BICYCLE_LOG_LINE_WIDTH_DEFAULT
  );

  map.addSource(BICYCLE_LOG_SELECTED_SOURCE_ID, { type: 'geojson', data: EMPTY_FEATURE_COLLECTION });
  addLineLayer(
    BICYCLE_LOG_SELECTED_SOURCE_ID,
    BICYCLE_LOG_SELECTED_LAYER_ID,
    BICYCLE_LOG_LINE_COLOR_SELECTED,
    BICYCLE_LOG_LINE_WIDTH_SELECTED
  );

  map.addSource(BICYCLE_LOG_FOCUSED_SOURCE_ID, { type: 'geojson', data: EMPTY_FEATURE_COLLECTION });
  addLineLayer(
    BICYCLE_LOG_FOCUSED_SOURCE_ID,
    BICYCLE_LOG_FOCUSED_OUTLINE_LAYER_ID,
    BICYCLE_LOG_FOCUSED_OUTLINE_COLOR,
    BICYCLE_LOG_FOCUSED_OUTLINE_WIDTH
  );
  addLineLayer(
    BICYCLE_LOG_FOCUSED_SOURCE_ID,
    BICYCLE_LOG_FOCUSED_LAYER_ID,
    BICYCLE_LOG_LINE_COLOR_FOCUSED,
    BICYCLE_LOG_LINE_WIDTH_FOCUSED
  );
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
 * トグル可能なレイヤーIDに対応する、実際のMapLibreスタイルレイヤーIDの一覧を求める
 * @param layerId トグル可能なレイヤーID
 * @param categorizedLayerIds カテゴリごとに分類されたスタイルレイヤーIDの一覧
 * @returns 対応するスタイルレイヤーIDの配列
 */
const resolveStyleLayerIds = (layerId: ToggleableLayerId, categorizedLayerIds: CategorizedLayerIds): string[] => {
  if (layerId === 'aerial-photo') {
    return [AERIAL_PHOTO_LAYER_ID];
  }
  if (layerId === 'bicycle-log') {
    return [
      BICYCLE_LOG_LAYER_ID,
      BICYCLE_LOG_SELECTED_LAYER_ID,
      BICYCLE_LOG_FOCUSED_OUTLINE_LAYER_ID,
      BICYCLE_LOG_FOCUSED_LAYER_ID
    ];
  }
  if (layerId === 'admin-boundary') {
    return [...categorizedLayerIds['admin-boundary'], ADMIN_BOUNDARY_MUNICIPALITY_LAYER_ID];
  }
  return categorizedLayerIds[layerId];
};

/**
 * 現在の表示/非表示状態を、対応するMapLibreスタイルレイヤーへ反映する
 * @param map 反映先のMapLibre地図インスタンス
 * @param categorizedLayerIds カテゴリごとに分類されたスタイルレイヤーIDの一覧
 * @param layerVisibility レイヤーIDごとの表示/非表示状態
 */
const applyLayerVisibility = (
  map: maplibregl.Map,
  categorizedLayerIds: CategorizedLayerIds,
  layerVisibility: LayerVisibility
) => {
  const entries = typedEntries(layerVisibility);

  for (const [layerId, isVisible] of entries) {
    const visibility = isVisible ? VISIBLE_VALUE : HIDDEN_VALUE;
    const styleLayerIds = resolveStyleLayerIds(layerId, categorizedLayerIds);
    for (const styleLayerId of styleLayerIds) {
      map.setLayoutProperty(styleLayerId, 'visibility', visibility);
    }
  }
};

/** MapLibreの地図本体を表示し、レイヤーの表示/非表示・自転車ログの新規アクティビティ取得・選択状態の描画を行うコンポーネント */
export const MapView = ({
  layerVisibility,
  selectedIds,
  focusedId,
  onSelectActivities,
  onActivitiesLoaded,
  filter
}: MapViewProps) => {
  const addError = useErrorReporter();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const categorizedLayerIdsRef = useRef<CategorizedLayerIds | null>(null);
  const wasBicycleLogVisibleRef = useRef(false);
  const startGoalMarkersRef = useRef<StartGoalMarkerEntry[]>([]);
  const [isStyleLoaded, setIsStyleLoaded] = useState(false);
  const [activities, setActivities] = useState<CyclingActivity[]>([]);
  const filteredActivities = useMemo(() => filterActivities(activities, filter), [activities, filter]);
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

  // layerVisibilityが変化するたびに各レイヤーの表示/非表示を反映し、
  // 自転車ログレイヤーがOFF→ONに変化した場合はStrava新規アクティビティ取得・データ取得を行う
  useEffect(() => {
    const map = mapRef.current;
    const categorizedLayerIds = categorizedLayerIdsRef.current;
    if (!map || !isStyleLoaded || !categorizedLayerIds) {
      return;
    }

    applyLayerVisibility(map, categorizedLayerIds, layerVisibility);

    const isBicycleLogVisible = layerVisibility['bicycle-log'];
    const wasBicycleLogVisible = wasBicycleLogVisibleRef.current;
    wasBicycleLogVisibleRef.current = isBicycleLogVisible;

    if (!wasBicycleLogVisible && isBicycleLogVisible) {
      void syncAndLoadBicycleLog(addError, (loaded) => {
        setActivities(loaded);
        onActivitiesLoaded(loaded);
      });
    }
  }, [layerVisibility, isStyleLoaded, addError, onActivitiesLoaded]);

  return <Box ref={containerRef} flex="1" minWidth="0" height="100%" data-testid="map-container" />;
};
