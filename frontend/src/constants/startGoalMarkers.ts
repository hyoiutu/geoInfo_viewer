// スタート・ゴールのマーカーはmaplibregl.Markerで地図に直接addする素のDOM要素であり、
// Chakra UIのコンポーネントツリー外（useTokenが使えない）でReactDOMServerにより静的にレンダリングするため、
// rules.mdの色トークン規約の対象外としてここに直接定義する（ChakraProviderが実行時に注入するCSSカスタム
// プロパティの変数名を直接参照することで、意味を持たせたトークンとしての一貫性は保っている）。
/** スタート地点マーカーのアイコン色（Chakra UIのgreen.600相当） */
export const START_MARKER_ICON_COLOR = 'var(--chakra-colors-green-600)';
/** ゴール地点マーカーのアイコン色（Chakra UIのred.600相当） */
export const GOAL_MARKER_ICON_COLOR = 'var(--chakra-colors-red-600)';
/** マーカーアイコンのサイズ(px) */
export const START_GOAL_MARKER_ICON_SIZE = 20;
