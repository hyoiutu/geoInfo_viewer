export const BICYCLE_LOG_SOURCE_ID = 'bicycle-log-source';
export const BICYCLE_LOG_LAYER_ID = 'bicycle-log-layer';
// 選択中・フォーカス中のアクティビティは、通常状態より手前(上)に描画する必要がある。
// MapLibreの単一レイヤー内では線layerに描画順を制御する仕組みが無いため、状態ごとに別レイヤー・
// 別ソースへ分離し、レイヤーを追加した順（=描画順）で「通常→選択→フォーカス」の手前関係を実現する
export const BICYCLE_LOG_SELECTED_SOURCE_ID = 'bicycle-log-selected-source';
export const BICYCLE_LOG_SELECTED_LAYER_ID = 'bicycle-log-selected-layer';
export const BICYCLE_LOG_FOCUSED_SOURCE_ID = 'bicycle-log-focused-source';
export const BICYCLE_LOG_FOCUSED_LAYER_ID = 'bicycle-log-focused-layer';
export const BICYCLE_LOG_LINE_WIDTH = 3;

// MapLibreのline-color paintプロパティはCSSカスタムプロパティを解釈できない（Canvas描画のため）ため、
// Chakra UIのtheme.tsトークンは経由せず、rules.mdの色トークン規約の対象外としてここに直接定義する
// （Chakra標準パレットのred.500/blue.500/purple.500相当の値を採用し、アプリ全体の配色トーンに合わせる）。
/** 通常状態（未選択）のアクティビティの線の色 */
export const BICYCLE_LOG_LINE_COLOR_DEFAULT = '#e53e3e';
/** 選択状態のアクティビティの線の色 */
export const BICYCLE_LOG_LINE_COLOR_SELECTED = '#3182ce';
/** フォーカス状態のアクティビティの線の色 */
export const BICYCLE_LOG_LINE_COLOR_FOCUSED = '#805ad5';
