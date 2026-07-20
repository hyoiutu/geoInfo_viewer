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

// 過去の行政区画（era!=='current'）は現行のベクトルタイルに存在しないため、バックエンドAPIから取得した
// GeoJSONを別ソースとして描画する（Issue #34フェーズ2）
export const ADMIN_BOUNDARY_HISTORICAL_SOURCE_ID = 'admin-boundary-historical-source';
export const ADMIN_BOUNDARY_HISTORICAL_FILL_LAYER_ID = 'admin-boundary-historical-fill';
export const ADMIN_BOUNDARY_HISTORICAL_LINE_LAYER_ID = 'admin-boundary-historical-line';
export const ADMIN_BOUNDARY_HISTORICAL_LABEL_LAYER_ID = 'admin-boundary-historical-label';
// 境界線の視認性を優先し、下地（航空写真等）を隠しすぎないよう塗りは非常に薄くする
export const ADMIN_BOUNDARY_HISTORICAL_FILL_COLOR = ADMIN_BOUNDARY_MUNICIPALITY_LINE_COLOR;
export const ADMIN_BOUNDARY_HISTORICAL_FILL_OPACITY = 0.05;
// 地名ラベル（label_city等）と同じ配色にし、既存OSMスタイルの見た目を模倣する
export const ADMIN_BOUNDARY_HISTORICAL_LABEL_TEXT_COLOR = '#000';
export const ADMIN_BOUNDARY_HISTORICAL_LABEL_HALO_COLOR = '#fff';
export const ADMIN_BOUNDARY_HISTORICAL_LABEL_HALO_WIDTH = 1;

// 行政区画クリック・通過自治体リストクリックによる範囲フォーカス機能に使う（Issue #76）。
// hit-testレイヤーは完全に透明なfillレイヤーで、queryRenderedFeatures/クリックイベントによる
// 「クリック地点を含む自治体の検出」専用に使い、見た目には影響しない
export const ADMIN_BOUNDARY_HITTEST_SOURCE_ID = 'admin-boundary-hittest-source';
export const ADMIN_BOUNDARY_HITTEST_FILL_LAYER_ID = 'admin-boundary-hittest-fill';
export const ADMIN_BOUNDARY_FOCUSED_SOURCE_ID = 'admin-boundary-focused-source';
export const ADMIN_BOUNDARY_FOCUSED_LINE_LAYER_ID = 'admin-boundary-focused-line';
// 自転車ログのフォーカス色(赤 #e53e3e)・ゴールマーカー(赤系)は既に「フォーカス中のアクティビティ」
// 「ゴール地点」を表す色として使われているため、行政区画のフォーカスには別の色相(オレンジ)を割り当てて
// 状態エンコーディングの衝突を避ける（Issue #76、issue_review_notes.md観点3）
export const ADMIN_BOUNDARY_FOCUSED_LINE_COLOR = '#dd6b20';
export const ADMIN_BOUNDARY_FOCUSED_LINE_WIDTH = 4;
export const ADMIN_BOUNDARY_FOCUSED_LINE_DASHARRAY: [number, number] = [2, 1];
