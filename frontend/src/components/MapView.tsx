import { Box } from '@chakra-ui/react';
import type { ExpressionSpecification } from '@maplibre/maplibre-gl-style-spec';
import type { FeatureCollection } from 'geojson';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState } from 'react';
import {
  type CyclingActivity,
  fetchCyclingActivities,
  getBackfillStatus,
  type SyncResult,
  syncCyclingActivities
} from '../api/activitiesApi';
import {
  AERIAL_PHOTO_ATTRIBUTION,
  AERIAL_PHOTO_LAYER_ID,
  AERIAL_PHOTO_MAX_ZOOM,
  AERIAL_PHOTO_SOURCE_ID,
  AERIAL_PHOTO_TILE_SIZE,
  AERIAL_PHOTO_TILE_URL
} from '../constants/aerialPhoto';
import {
  BICYCLE_LOG_LAYER_ID,
  BICYCLE_LOG_LINE_COLOR_DEFAULT,
  BICYCLE_LOG_LINE_COLOR_FOCUSED,
  BICYCLE_LOG_LINE_COLOR_SELECTED,
  BICYCLE_LOG_LINE_WIDTH,
  BICYCLE_LOG_SOURCE_ID
} from '../constants/bicycleLog';
import type { AppErrorInfo } from '../types/apiError';
import type { LayerVisibility, ToggleableLayerId } from '../types/layer';
import { toAppErrorInfo } from '../utils/apiError';
import { cyclingActivityToGeoJson } from '../utils/cyclingActivityToGeoJson';
import { groupLayerIdsByCategory } from '../utils/mapLayerCategory';

const OSM_VECTOR_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const DEFAULT_ZOOM = 12;
const DEFAULT_CENTER: [number, number] = [139.1798829, 35.2756364];
const VISIBLE_VALUE = 'visible';
const HIDDEN_VALUE = 'none';
const EMPTY_FEATURE_COLLECTION: FeatureCollection = { type: 'FeatureCollection', features: [] };
// 自転車ログの線は太さ3pxと細く正確なクリックが難しいため、クリック地点を中心とした
// 10px四方(片側5px)のバウンディングボックスでヒットテストする
const HIT_TEST_RADIUS_PX = 5;
const BICYCLE_LOG_LINE_COLOR_EXPRESSION: ExpressionSpecification = [
  'case',
  ['boolean', ['feature-state', 'focused'], false],
  BICYCLE_LOG_LINE_COLOR_FOCUSED,
  ['boolean', ['feature-state', 'selected'], false],
  BICYCLE_LOG_LINE_COLOR_SELECTED,
  BICYCLE_LOG_LINE_COLOR_DEFAULT
];

/** MapViewのprops */
type MapViewProps = {
  /** レイヤーIDごとの表示/非表示状態 */
  layerVisibility: LayerVisibility;
  /** API呼び出し等でエラーが発生したときに呼ばれるコールバック */
  onError: (error: AppErrorInfo) => void;
  /** 選択中のアクティビティID一覧 */
  selectedIds: string[];
  /** フォーカス中のアクティビティID。未フォーカスの場合はnull */
  focusedId: string | null;
  /** 地図クリックでアクティビティが検出されたときに呼ばれるコールバック */
  onSelectActivities: (ids: string[]) => void;
  /** 自転車ログのデータ取得・更新のたびに、取得済みアクティビティ一覧を渡すコールバック */
  onActivitiesLoaded: (activities: CyclingActivity[]) => void;
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
 * 自転車ログ用の空のGeoJSONソース・ラインレイヤーを地図に追加する
 * @param map 追加先のMapLibre地図インスタンス
 */
const addBicycleLogLayer = (map: maplibregl.Map) => {
  // feature-state(selected/focused)によるクリックごとの再描画をline-color式で軽量に行うため、
  // アクティビティIDをフィーチャーIDに昇格させる（毎回GeoJSON全体を作り直さずに済む）
  map.addSource(BICYCLE_LOG_SOURCE_ID, {
    type: 'geojson',
    data: EMPTY_FEATURE_COLLECTION,
    promoteId: 'id'
  });
  map.addLayer({
    id: BICYCLE_LOG_LAYER_ID,
    type: 'line',
    source: BICYCLE_LOG_SOURCE_ID,
    paint: {
      'line-color': BICYCLE_LOG_LINE_COLOR_EXPRESSION,
      'line-width': BICYCLE_LOG_LINE_WIDTH
    }
  });
};

/**
 * Strava上の新規アクティビティを同期し、自転車ログのGeoJSONソースを最新のデータで更新する
 * @param map 更新対象のMapLibre地図インスタンス
 * @param onError API呼び出し失敗時に呼ばれるコールバック
 * @param onActivitiesLoaded 取得に成功したアクティビティ一覧を渡すコールバック
 */
const syncAndLoadBicycleLog = async (
  map: maplibregl.Map,
  onError: (error: AppErrorInfo) => void,
  onActivitiesLoaded: (activities: CyclingActivity[]) => void
) => {
  // 初期取り込み(バックフィル)実行中は更新用APIを呼ばず、その時点でDBに取得済みの分だけ表示する
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
    const source = map.getSource(BICYCLE_LOG_SOURCE_ID) as maplibregl.GeoJSONSource;
    source.setData(cyclingActivityToGeoJson(activities));
    onActivitiesLoaded(activities);
  } catch (error) {
    onError(toAppErrorInfo(error));
  }
};

/**
 * 自転車ログレイヤーのクリックを検出し、選択中アクティビティに追加する。
 * 線が細く正確なクリックが難しいため、クリック地点を中心としたバウンディングボックスでヒットテストする
 * @param map クリックを監視するMapLibre地図インスタンス
 * @param onSelectActivities 検出したアクティビティID一覧を渡すコールバック
 */
const registerBicycleLogClickHandler = (map: maplibregl.Map, onSelectActivities: (ids: string[]) => void) => {
  map.on('click', (event) => {
    const bbox: [maplibregl.PointLike, maplibregl.PointLike] = [
      [event.point.x - HIT_TEST_RADIUS_PX, event.point.y - HIT_TEST_RADIUS_PX],
      [event.point.x + HIT_TEST_RADIUS_PX, event.point.y + HIT_TEST_RADIUS_PX]
    ];
    const features = map.queryRenderedFeatures(bbox, { layers: [BICYCLE_LOG_LAYER_ID] });
    // 同一クリックでも複数の描画フィーチャーが同一アクティビティIDを指しうるため重複排除する
    const ids = [...new Set(features.map((feature) => String(feature.properties?.id)))];
    if (ids.length > 0) {
      onSelectActivities(ids);
    }
  });
};

/**
 * 選択・フォーカス状態を、自転車ログの各アクティビティのfeature-stateへ反映する
 * @param map 反映先のMapLibre地図インスタンス
 * @param activities 現在地図に描画されているアクティビティ一覧
 * @param selectedIds 選択中のアクティビティID一覧
 * @param focusedId フォーカス中のアクティビティID。未フォーカスの場合はnull
 */
const applyActivitySelectionState = (
  map: maplibregl.Map,
  activities: CyclingActivity[],
  selectedIds: string[],
  focusedId: string | null
) => {
  const selectedIdSet = new Set(selectedIds);
  for (const activity of activities) {
    map.setFeatureState(
      { source: BICYCLE_LOG_SOURCE_ID, id: activity.id },
      { selected: selectedIdSet.has(activity.id), focused: activity.id === focusedId }
    );
  }
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
    return [BICYCLE_LOG_LAYER_ID];
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
  const entries = Object.entries(layerVisibility) as [ToggleableLayerId, boolean][];

  for (const [layerId, isVisible] of entries) {
    const visibility = isVisible ? VISIBLE_VALUE : HIDDEN_VALUE;
    const styleLayerIds = resolveStyleLayerIds(layerId, categorizedLayerIds);
    for (const styleLayerId of styleLayerIds) {
      map.setLayoutProperty(styleLayerId, 'visibility', visibility);
    }
  }
};

/** MapLibreの地図本体を表示し、レイヤーの表示/非表示・自転車ログの同期・選択状態の描画を行うコンポーネント */
export const MapView = ({
  layerVisibility,
  onError,
  selectedIds,
  focusedId,
  onSelectActivities,
  onActivitiesLoaded
}: MapViewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const categorizedLayerIdsRef = useRef<CategorizedLayerIds | null>(null);
  const wasBicycleLogVisibleRef = useRef(false);
  const [isStyleLoaded, setIsStyleLoaded] = useState(false);
  const [activities, setActivities] = useState<CyclingActivity[]>([]);
  // クリックハンドラはマウント時に一度だけ登録するため、最新のコールバックをrefで参照する（クロージャの陳腐化対策）
  const onSelectActivitiesRef = useRef(onSelectActivities);
  onSelectActivitiesRef.current = onSelectActivities;

  // マウント時に一度だけMapLibreの地図を生成し、スタイル読み込み完了後に航空写真・自転車ログレイヤーを追加する
  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_VECTOR_STYLE_URL,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM
    });
    mapRef.current = map;

    map.once('load', () => {
      const categorizedLayerIds = groupLayerIdsByCategory(map.getStyle().layers ?? []);
      categorizedLayerIdsRef.current = categorizedLayerIds;
      addAerialPhotoLayer(map, categorizedLayerIds);
      addBicycleLogLayer(map);
      registerBicycleLogClickHandler(map, (ids) => onSelectActivitiesRef.current(ids));
      setIsStyleLoaded(true);
    });

    return () => {
      mapRef.current = null;
      map.remove();
    };
  }, []);

  // 選択中・フォーカス中のアクティビティが変化するたびに、対応するfeature-stateを更新し線の色に反映する
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isStyleLoaded) {
      return;
    }

    applyActivitySelectionState(map, activities, selectedIds, focusedId);
  }, [activities, selectedIds, focusedId, isStyleLoaded]);

  // layerVisibilityが変化するたびに各レイヤーの表示/非表示を反映し、
  // 自転車ログレイヤーがOFF→ONに変化した場合はStrava同期・データ取得を行う
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
      void syncAndLoadBicycleLog(map, onError, (loaded) => {
        setActivities(loaded);
        onActivitiesLoaded(loaded);
      });
    }
  }, [layerVisibility, isStyleLoaded, onError, onActivitiesLoaded]);

  return <Box ref={containerRef} flex="1" minWidth="0" height="100vh" data-testid="map-container" />;
};
