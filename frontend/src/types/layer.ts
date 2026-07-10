export type ToggleableLayerId =
  | 'osm-poi'
  | 'osm-road'
  | 'osm-building'
  | 'osm-place-name'
  | 'aerial-photo'
  | 'bicycle-log';

export type LayerVisibility = Record<ToggleableLayerId, boolean>;
