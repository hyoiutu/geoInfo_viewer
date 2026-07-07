import type { ToggleableLayerId } from '../types/layer';

export type LayerDefinition = {
  id: ToggleableLayerId;
  name: string;
  defaultChecked: boolean;
};

export const LAYER_DEFINITIONS: LayerDefinition[] = [
  { id: 'osm-poi', name: 'POI', defaultChecked: true },
  { id: 'osm-road', name: '道路', defaultChecked: true },
  { id: 'osm-building', name: '建物', defaultChecked: true },
  { id: 'osm-place-name', name: '地名', defaultChecked: true },
  { id: 'aerial-photo', name: '航空写真', defaultChecked: false }
];
