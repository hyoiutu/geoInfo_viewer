/** ユーザーがON/OFFを切り替えられるレイヤーの識別子 */
export type ToggleableLayerId =
  | 'osm-poi'
  | 'osm-road'
  | 'osm-building'
  | 'osm-place-name'
  | 'admin-boundary'
  | 'aerial-photo'
  | 'bicycle-log';

/** レイヤーIDごとの表示/非表示状態 */
export type LayerVisibility = Record<ToggleableLayerId, boolean>;

/** トグル可能なレイヤーIDごとに分類された、実際のMapLibreスタイルレイヤーIDの一覧 */
export type CategorizedLayerIds = Record<ToggleableLayerId, string[]>;
