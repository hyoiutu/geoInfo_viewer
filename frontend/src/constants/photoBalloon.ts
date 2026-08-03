/** 写真吹き出し表示のクラスタリング半径（ピクセル）。この範囲内にある写真をまとめて1つのクラスタにする（Issue #107） */
export const PHOTO_BALLOON_CLUSTER_RADIUS_PX = 60;
/** 写真吹き出し表示のクラスタリング最大ズームレベル。これを超えるズームレベルでは常に個別の写真として表示する */
export const PHOTO_BALLOON_CLUSTER_MAX_ZOOM = 20;
/** 単一写真の吹き出し（サムネイル画像）の一辺のサイズ（px） */
export const PHOTO_BALLOON_THUMBNAIL_SIZE_PX = 48;
/** クラスタ（近接する複数写真をまとめたもの）バッジの直径（px） */
export const PHOTO_BALLOON_CLUSTER_BADGE_SIZE_PX = 32;
/**
 * クラスタバッジの背景色（Chakra UIのblue.500相当）。`PhotoBalloonClusterBadge`は`maplibregl.Marker`用の
 * 独立したReact rootへマウントされ`ChakraProvider`配下に含まれないため、ui_rules.mdの色トークン規約の
 * 対象外としてここに直接定義する（`constants/startGoalMarkers.ts`と同じ理由・同じ回避策。PR #117レビュー対応）
 */
export const PHOTO_BALLOON_CLUSTER_BADGE_COLOR = 'var(--chakra-colors-blue-500)';
/** クラスタバッジの件数テキストのフォントサイズ（px） */
export const PHOTO_BALLOON_CLUSTER_BADGE_FONT_SIZE_PX = 14;
