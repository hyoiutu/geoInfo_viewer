import type { LayerSpecification } from 'maplibre-gl';
import type { ToggleableLayerId } from '../types/layer';

const OSM_ROAD_SOURCE_LAYERS = new Set(['transportation', 'transportation_name', 'aeroway']);
const OSM_PLACE_NAME_SOURCE_LAYERS = new Set(['place', 'water_name']);
const AIRPORT_LAYER_ID = 'airport';
const SYMBOL_TYPE = 'symbol';
const WATERWAY_SOURCE_LAYER = 'waterway';
const BUILDING_SOURCE_LAYER = 'building';
const POI_SOURCE_LAYER = 'poi';

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
  if (sourceLayer !== undefined && OSM_PLACE_NAME_SOURCE_LAYERS.has(sourceLayer)) {
    return 'osm-place-name';
  }
  if (sourceLayer === WATERWAY_SOURCE_LAYER && layer.type === SYMBOL_TYPE) {
    return 'osm-place-name';
  }

  return null;
};

export const groupLayerIdsByCategory = (layers: LayerSpecification[]): Record<ToggleableLayerId, string[]> => {
  const grouped: Record<ToggleableLayerId, string[]> = {
    'osm-poi': [],
    'osm-road': [],
    'osm-building': [],
    'osm-place-name': [],
    'aerial-photo': []
  };

  for (const layer of layers) {
    const category = categorizeStyleLayer(layer);
    if (category !== null) {
      grouped[category].push(layer.id);
    }
  }

  return grouped;
};
