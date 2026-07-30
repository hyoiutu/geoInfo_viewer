/** 写真吹き出し表示のクラスタリング半径（ピクセル）。この範囲内にある写真をまとめて1つのクラスタにする（Issue #107） */
export const PHOTO_BALLOON_CLUSTER_RADIUS_PX = 60;
/** 写真吹き出し表示のクラスタリング最大ズームレベル。これを超えるズームレベルでは常に個別の写真として表示する */
export const PHOTO_BALLOON_CLUSTER_MAX_ZOOM = 20;
/** 単一写真の吹き出し（サムネイル画像）の一辺のサイズ（px） */
export const PHOTO_BALLOON_THUMBNAIL_SIZE_PX = 48;
/** クラスタ（近接する複数写真をまとめたもの）バッジの直径（px） */
export const PHOTO_BALLOON_CLUSTER_BADGE_SIZE_PX = 32;
