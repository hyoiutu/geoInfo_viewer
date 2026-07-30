import { useState } from 'react';
import { resolvePhotoImageUrl, resolvePhotoThumbnailUrl } from '../api/photosApi';

/** usePhotoThumbnailFallbackの戻り値 */
export type UsePhotoThumbnailFallbackResult = {
  /** 表示に使うべきURL（サムネイル優先、失敗後はフルサイズ） */
  src: string;
  /** 画像の読み込みが完了した（成功・諦めのいずれか）かどうか */
  isLoaded: boolean;
  /** 画像のonLoadへそのまま渡す */
  handleLoad: () => void;
  /** 画像のonErrorへそのまま渡す */
  handleError: () => void;
};

/**
 * サムネイル優先・404等の読み込み失敗時にフルサイズ画像へ1度だけフォールバックする、写真表示の
 * 共通ロジック。アクティビティパネルの写真グリッド（`PhotoGridItem`、Issue #105）・地図上の写真吹き出し
 * （`PhotoBalloonThumbnail`、Issue #107）の両方で同じ挙動が必要なため切り出した（DRY）
 * @param photoId 対象の写真ID
 * @returns 表示に使うURL・読み込み完了フラグ・onLoad/onErrorへ渡すハンドラ
 */
export const usePhotoThumbnailFallback = (photoId: number): UsePhotoThumbnailFallbackResult => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasThumbnailFailed, setHasThumbnailFailed] = useState(false);

  const handleError = () => {
    if (!hasThumbnailFailed) {
      setHasThumbnailFailed(true);
      return;
    }
    setIsLoaded(true);
  };

  return {
    src: hasThumbnailFailed ? resolvePhotoImageUrl(photoId) : resolvePhotoThumbnailUrl(photoId),
    isLoaded,
    handleLoad: () => setIsLoaded(true),
    handleError
  };
};
