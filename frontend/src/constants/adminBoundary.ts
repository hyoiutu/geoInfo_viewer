import type { FilterSpecification } from 'maplibre-gl';

/** 市町村行政区画レイヤーが参照するベクトルタイルソースのID（OSM標準スタイルの「openmaptiles」ソースを再利用する） */
export const ADMIN_BOUNDARY_MUNICIPALITY_SOURCE_ID = 'openmaptiles';
/** 市町村行政区画レイヤーが参照するソースレイヤー名（都道府県境界と同じ「boundary」ソースレイヤーを使う） */
export const ADMIN_BOUNDARY_MUNICIPALITY_SOURCE_LAYER = 'boundary';
export const ADMIN_BOUNDARY_MUNICIPALITY_LAYER_ID = 'admin-boundary-municipality';
// 市町村・区に相当するadmin_level(7〜8)のみを対象とする。都道府県境界(admin_level 3〜6)は
// 既存のboundary_3レイヤーをそのまま使うため、ここでは追加しない
export const ADMIN_BOUNDARY_MUNICIPALITY_FILTER: FilterSpecification = [
  'all',
  ['>=', ['get', 'admin_level'], 7],
  ['<=', ['get', 'admin_level'], 8],
  ['!=', ['get', 'maritime'], 1],
  ['!=', ['get', 'disputed'], 1],
  ['!', ['has', 'claimed_by']]
];
// 都道府県境界(boundary_3)と同じ色・破線パターンにし、既存OSMスタイルの見た目を模倣する
export const ADMIN_BOUNDARY_MUNICIPALITY_LINE_COLOR = 'hsl(0, 0%, 70%)';
export const ADMIN_BOUNDARY_MUNICIPALITY_LINE_DASHARRAY: [number, number] = [1, 1];
// 市町村境界は都道府県境界よりズームインした際にのみ意味を持つ情報のため、低ズームでの過密表示を避ける
export const ADMIN_BOUNDARY_MUNICIPALITY_MIN_ZOOM = 8;
