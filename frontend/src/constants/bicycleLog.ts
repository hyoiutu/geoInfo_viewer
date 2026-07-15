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
// （Chakra標準パレットのpink.200/pink.400相当の値を採用し、アプリ全体の配色トーンに合わせる。
// フォーカス状態の色は、原色による色分けが重なると見にくいという指摘(Issue #26)を受け、
// 赤ベースで薄さのみで区別する配色に変更した際、以前デフォルト状態に使っていた赤(#e53e3e)をそのまま流用している）。
/** 通常状態（未選択）のアクティビティの線の色（淡いピンク） */
export const BICYCLE_LOG_LINE_COLOR_DEFAULT = '#fbb6ce';
/** 選択状態のアクティビティの線の色（通常状態より濃いが薄いピンク） */
export const BICYCLE_LOG_LINE_COLOR_SELECTED = '#ed64a6';
/** フォーカス状態のアクティビティの線の色（赤） */
export const BICYCLE_LOG_LINE_COLOR_FOCUSED = '#e53e3e';
