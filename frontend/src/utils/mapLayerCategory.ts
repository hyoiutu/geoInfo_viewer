import type { LayerSpecification } from 'maplibre-gl';
import {
  ADMIN_BOUNDARY_FOCUSED_LINE_LAYER_ID,
  ADMIN_BOUNDARY_HISTORICAL_FILL_LAYER_ID,
  ADMIN_BOUNDARY_HISTORICAL_LABEL_LAYER_ID,
  ADMIN_BOUNDARY_HISTORICAL_LINE_LAYER_ID,
  ADMIN_BOUNDARY_HITTEST_FILL_LAYER_ID,
  ADMIN_BOUNDARY_MUNICIPALITY_LAYER_ID
} from '../constants/adminBoundary';
import { AERIAL_PHOTO_LAYER_ID } from '../constants/aerialPhoto';
import {
  BICYCLE_LOG_FOCUSED_LAYER_ID,
  BICYCLE_LOG_FOCUSED_OUTLINE_LAYER_ID,
  BICYCLE_LOG_LAYER_ID,
  BICYCLE_LOG_SELECTED_LAYER_ID
} from '../constants/bicycleLog';
import type { CategorizedLayerIds, ToggleableLayerId } from '../types/layer';
import { MUNICIPALITY_ERA_CURRENT, type MunicipalityEra } from '../types/municipalityEra';

const OSM_ROAD_SOURCE_LAYERS = new Set(['transportation', 'transportation_name', 'aeroway']);
const OSM_PLACE_NAME_SOURCE_LAYERS = new Set(['water_name']);
const AIRPORT_LAYER_ID = 'airport';
const SYMBOL_TYPE = 'symbol';
const WATERWAY_SOURCE_LAYER = 'waterway';
const BUILDING_SOURCE_LAYER = 'building';
const POI_SOURCE_LAYER = 'poi';
const BOUNDARY_SOURCE_LAYER = 'boundary';
// boundary_2(国境)・boundary_disputed(係争地境界)は都道府県・市町村の行政区画ではないため対象外とする
const ADMIN_BOUNDARY_STYLE_LAYER_IDS = new Set(['boundary_3']);
// placeソースレイヤーのうち都道府県・市町村名のみ（国名・大陸名・その他の地名は含めない）
const ADMIN_PLACE_LABEL_LAYER_IDS = new Set([
  'label_state',
  'label_city',
  'label_city_capital',
  'label_town',
  'label_village'
]);

/**
 * MapLibreのスタイルレイヤーが、どのトグル可能なレイヤーカテゴリに属するかを判定する
 * @param layer 判定対象のMapLibreスタイルレイヤー定義
 * @returns 属するカテゴリのID。どのカテゴリにも属さない場合はnull
 */
export const categorizeStyleLayer = (layer: LayerSpecification): ToggleableLayerId | null => {
  const sourceLayer = 'source-layer' in layer ? layer['source-layer'] : undefined;

  if (sourceLayer === BUILDING_SOURCE_LAYER) {
    return 'osm-building';
  }
  if (sourceLayer === POI_SOURCE_LAYER || layer.id === AIRPORT_LAYER_ID) {
    return 'osm-poi';
  }
  if (sourceLayer !== undefined && OSM_ROAD_SOURCE_LAYERS.has(sourceLayer)) {
    return 'osm-road';
  }
  if (sourceLayer === BOUNDARY_SOURCE_LAYER) {
    return ADMIN_BOUNDARY_STYLE_LAYER_IDS.has(layer.id) ? 'admin-boundary' : null;
  }
  if (sourceLayer === 'place') {
    return ADMIN_PLACE_LABEL_LAYER_IDS.has(layer.id) ? 'admin-boundary' : 'osm-place-name';
  }
  if (sourceLayer !== undefined && OSM_PLACE_NAME_SOURCE_LAYERS.has(sourceLayer)) {
    return 'osm-place-name';
  }
  if (sourceLayer === WATERWAY_SOURCE_LAYER && layer.type === SYMBOL_TYPE) {
    return 'osm-place-name';
  }

  return null;
};

/**
 * MapLibreのスタイルレイヤー一覧を、トグル可能なレイヤーカテゴリごとのレイヤーIDリストへ分類する
 * @param layers MapLibreのスタイルレイヤー定義一覧
 * @returns カテゴリIDをキーとした、そのカテゴリに属するレイヤーIDの配列
 */
export const groupLayerIdsByCategory = (layers: LayerSpecification[]): Record<ToggleableLayerId, string[]> => {
  const grouped: Record<ToggleableLayerId, string[]> = {
    'osm-poi': [],
    'osm-road': [],
    'osm-building': [],
    'osm-place-name': [],
    'admin-boundary': [],
    'aerial-photo': [],
    'bicycle-log': []
  };

  for (const layer of layers) {
    const category = categorizeStyleLayer(layer);
    if (category !== null) {
      grouped[category].push(layer.id);
    }
  }

  return grouped;
};

/**
 * トグル可能なレイヤーIDに対応する、実際のMapLibreスタイルレイヤーIDの一覧を求める。
 * admin-boundaryは選択中の年代によって参照するレイヤーが異なる（current: 現行のベクトルタイル、
 * それ以外: 過去年代用にGeoJSONで描画している塗り・線・ラベルレイヤー）
 * @param layerId トグル可能なレイヤーID
 * @param categorizedLayerIds カテゴリごとに分類されたスタイルレイヤーIDの一覧
 * @param adminBoundaryEra 選択中の行政区画の年代識別子（admin-boundary以外のlayerIdでは無視される）
 * @returns 対応するスタイルレイヤーIDの配列
 */
export const resolveStyleLayerIds = (
  layerId: ToggleableLayerId,
  categorizedLayerIds: CategorizedLayerIds,
  adminBoundaryEra: MunicipalityEra
): string[] => {
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
    // hit-test・フォーカス表示レイヤー（Issue #76）は現行・過去いずれの年代でも同じソースを使うため、
    // 年代に関わらずadmin-boundaryのトグルに含める
    if (adminBoundaryEra === MUNICIPALITY_ERA_CURRENT) {
      return [
        ...categorizedLayerIds['admin-boundary'],
        ADMIN_BOUNDARY_MUNICIPALITY_LAYER_ID,
        ADMIN_BOUNDARY_HITTEST_FILL_LAYER_ID,
        ADMIN_BOUNDARY_FOCUSED_LINE_LAYER_ID
      ];
    }
    return [
      ADMIN_BOUNDARY_HISTORICAL_FILL_LAYER_ID,
      ADMIN_BOUNDARY_HISTORICAL_LINE_LAYER_ID,
      ADMIN_BOUNDARY_HISTORICAL_LABEL_LAYER_ID,
      ADMIN_BOUNDARY_HITTEST_FILL_LAYER_ID,
      ADMIN_BOUNDARY_FOCUSED_LINE_LAYER_ID
    ];
  }
  return categorizedLayerIds[layerId];
};

/**
 * 選択中の行政区画の年代では使用しない（表示に使わない）方のレイヤーID一覧を求める。
 * admin-boundaryは選択中の年代によって現行/過去年代のいずれかのレイヤー群のみを使うため、
 * 使わない方は行政区画レイヤーのON/OFFに関わらず常に非表示にする必要がある（Issue #67）
 * @param categorizedLayerIds カテゴリごとに分類されたスタイルレイヤーIDの一覧
 * @param adminBoundaryEra 選択中の行政区画の年代識別子
 * @returns 選択中の年代では使用しない方のスタイルレイヤーIDの配列
 */
export const resolveUnusedAdminBoundaryLayerIds = (
  categorizedLayerIds: CategorizedLayerIds,
  adminBoundaryEra: MunicipalityEra
): string[] => {
  if (adminBoundaryEra === MUNICIPALITY_ERA_CURRENT) {
    return [
      ADMIN_BOUNDARY_HISTORICAL_FILL_LAYER_ID,
      ADMIN_BOUNDARY_HISTORICAL_LINE_LAYER_ID,
      ADMIN_BOUNDARY_HISTORICAL_LABEL_LAYER_ID
    ];
  }
  return [...categorizedLayerIds['admin-boundary'], ADMIN_BOUNDARY_MUNICIPALITY_LAYER_ID];
};
