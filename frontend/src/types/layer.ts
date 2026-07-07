export type ToggleableLayerId = 'osm-poi' | 'osm-road' | 'osm-building' | 'osm-place-name' | 'aerial-photo';

export type LayerVisibility = Record<ToggleableLayerId, boolean>;
