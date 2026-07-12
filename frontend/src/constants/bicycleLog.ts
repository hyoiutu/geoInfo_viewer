export const BICYCLE_LOG_SOURCE_ID = 'bicycle-log-source';
export const BICYCLE_LOG_LAYER_ID = 'bicycle-log-layer';
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
