export const BICYCLE_LOG_SOURCE_ID = 'bicycle-log-source';
export const BICYCLE_LOG_LAYER_ID = 'bicycle-log-layer';
// 選択中・フォーカス中のアクティビティは、通常状態より手前(上)に描画する必要がある。
// MapLibreの単一レイヤー内では線layerに描画順を制御する仕組みが無いため、状態ごとに別レイヤー・
// 別ソースへ分離し、レイヤーを追加した順（=描画順）で「通常→選択→フォーカス」の手前関係を実現する
export const BICYCLE_LOG_SELECTED_SOURCE_ID = 'bicycle-log-selected-source';
export const BICYCLE_LOG_SELECTED_LAYER_ID = 'bicycle-log-selected-layer';
export const BICYCLE_LOG_FOCUSED_SOURCE_ID = 'bicycle-log-focused-source';
// フォーカス中の線は他の線に埋もれず視認できるよう、色付き本体の下(=先に追加するレイヤー)に
// 地図背景色の縁取り(ハロー)を敷く。ハローは本体と同じソース(BICYCLE_LOG_FOCUSED_SOURCE_ID)を参照する
export const BICYCLE_LOG_FOCUSED_OUTLINE_LAYER_ID = 'bicycle-log-focused-outline-layer';
export const BICYCLE_LOG_FOCUSED_LAYER_ID = 'bicycle-log-focused-layer';
// 低ズームレベル表示用の簡略化された軌跡（summary_polyline由来）専用のソース・レイヤー（Issue #61）。
// このズームレベルでは選択・フォーカス操作自体を無効にするため、通常状態の1種類のみで足りる
export const BICYCLE_LOG_SUMMARY_SOURCE_ID = 'bicycle-log-summary-source';
export const BICYCLE_LOG_SUMMARY_LAYER_ID = 'bicycle-log-summary-layer';

// 状態が視覚的に重なっても区別しやすいよう、線幅も色相と合わせて段階的に太くする
/** 通常状態（未選択）のアクティビティの線幅 */
export const BICYCLE_LOG_LINE_WIDTH_DEFAULT = 2;
/** 選択状態のアクティビティの線幅 */
export const BICYCLE_LOG_LINE_WIDTH_SELECTED = 3;
/** フォーカス状態のアクティビティの線幅 */
export const BICYCLE_LOG_LINE_WIDTH_FOCUSED = 4;
/** フォーカス状態の線の縁取り(ハロー)の幅。本体より太く、本体の下に描画することで縁取りとして見せる */
export const BICYCLE_LOG_FOCUSED_OUTLINE_WIDTH = BICYCLE_LOG_LINE_WIDTH_FOCUSED + 3;

// MapLibreのline-color paintプロパティはCSSカスタムプロパティを解釈できない（Canvas描画のため）ため、
// Chakra UIのtheme.tsトークンは経由せず、ui_rules.mdの色トークン規約の対象外としてここに直接定義する
// （未選択・選択中・フォーカス中は「識別(どのアクティビティか)」ではなく「状態」を表すため、
// 同一色相の濃淡ではなく色相自体を変える配色にした(Issue #26フォローアップ)。
// 未選択はChakra gray.500相当（地図背景に対して低彩度で後退して見える）、
// 選択中はChakra blue.500相当、フォーカス中は元々のデフォルト色だった赤(#e53e3e)をそのまま流用している。
// スタート・ゴールマーカー同様、地図背景色に合わせたテーマ切り替えは行わずライトモード固定の白でハローを敷く）。
/** 通常状態（未選択）のアクティビティの線の色（グレー） */
export const BICYCLE_LOG_LINE_COLOR_DEFAULT = '#718096';
/** 選択状態のアクティビティの線の色（青） */
export const BICYCLE_LOG_LINE_COLOR_SELECTED = '#3182ce';
/** フォーカス状態のアクティビティの線の色（赤） */
export const BICYCLE_LOG_LINE_COLOR_FOCUSED = '#e53e3e';
/** フォーカス状態の線の縁取り(ハロー)の色。マーカーの背景色と揃え、地図背景色によらず視認できる白を使う */
export const BICYCLE_LOG_FOCUSED_OUTLINE_COLOR = '#ffffff';
/** 低ズームレベル表示用の簡略化された軌跡の線の色。通常状態と同じグレーを使う */
export const BICYCLE_LOG_SUMMARY_LINE_COLOR = BICYCLE_LOG_LINE_COLOR_DEFAULT;
/** 低ズームレベル表示用の簡略化された軌跡の線幅 */
export const BICYCLE_LOG_SUMMARY_LINE_WIDTH = BICYCLE_LOG_LINE_WIDTH_DEFAULT;

// このズームレベル以下では、高解像度の軌跡(path)ではなく低ズームレベル用の簡略化された軌跡(summaryPath)を
// 表示し、アクティビティの選択・フォーカス操作も無効にする（Issue #61）。
// MapLibreのminzoom/maxzoomは「maxzoom以上で非表示」の仕様のため、summary側はmaxzoom、高解像度側は
// 同じ値をminzoomとして使う（ズームレベルちょうど10の瞬間のみ高解像度側が優先されるが、連続的に変化する
// ズーム操作の中では実用上体感できる差ではない）
/** 自転車ログの表示をsummary_polyline由来の軽量表示に切り替えるズームレベルのしきい値 */
export const BICYCLE_LOG_SUMMARY_MAX_ZOOM = 10;
