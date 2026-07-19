import type { LayerVisibility, ToggleableLayerId } from '../types/layer';
import { typedFromEntries } from '../utils/typedObject';

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
  { id: 'admin-boundary', name: '行政区画', defaultChecked: true },
  { id: 'aerial-photo', name: '航空写真', defaultChecked: false },
  { id: 'bicycle-log', name: '自転車ログ', defaultChecked: false }
];

/** @returns LAYER_DEFINITIONSのdefaultCheckedを反映したデフォルトの表示状態 */
export const createDefaultVisibility = (): LayerVisibility =>
  typedFromEntries(LAYER_DEFINITIONS.map((layerDefinition) => [layerDefinition.id, layerDefinition.defaultChecked]));
