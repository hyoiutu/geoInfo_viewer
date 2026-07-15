import type { LayerSpecification } from 'maplibre-gl';
import type { ToggleableLayerId } from '../types/layer';

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
