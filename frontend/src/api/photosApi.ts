const DEFAULT_BACKEND_BASE_URL = 'http://localhost:3000';
// E2Eテストは開発用バックエンド(3000番ポート)との衝突を避けるため別ポートで起動する。
// ビルド時にVITE_BACKEND_BASE_URLを設定することで接続先を切り替える（playwright.config.ts参照）
const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_BASE_URL ?? DEFAULT_BACKEND_BASE_URL;
const PHOTOS_PATH = '/photos';

/**
 * 指定した写真IDの画像バイナリを取得するURLを組み立てる。`<img>`のsrc等にそのまま使う
 * （画像自体はJSONではなくバイナリで返るため、他のAPIのようなfetchラッパーは持たずURLのみ提供する）
 * @param photoId 対象の写真ID
 * @returns 画像取得用のURL
 */
export const resolvePhotoImageUrl = (photoId: number): string => `${BACKEND_BASE_URL}${PHOTOS_PATH}/${photoId}/image`;
