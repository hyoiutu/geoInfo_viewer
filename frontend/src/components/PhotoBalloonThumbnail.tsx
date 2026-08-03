import { PHOTO_BALLOON_THUMBNAIL_SIZE_PX } from '../constants/photoBalloon';
import { usePhotoThumbnailFallback } from '../hooks/usePhotoThumbnailFallback';

/** PhotoBalloonThumbnailのprops */
type PhotoBalloonThumbnailProps = {
  /** 対象の写真ID */
  photoId: number;
  /** altテキストに使うファイル名 */
  fileName: string;
};

/**
 * 地図上の写真吹き出し（単一写真）に表示するサムネイル画像。`PhotoGridItem`（`ActivityDetailSidebar.tsx`、
 * Issue #105）と同じ「サムネイル優先・失敗時はフルサイズへフォールバック・読み込み完了まで非表示」の
 * 方針を`usePhotoThumbnailFallback`で共通化する。読み込みが完了するまで非表示のため、
 * アクティビティフォーカス時に全写真の読み込みを一斉に開始しつつ、完了したものから順に
 * 地図上へ表示されていく（Issue #107）。
 * `maplibregl.Marker`用に`react-dom/client`の独立したReact root（`photoBalloonElement.ts`）へ
 * マウントされ、アプリ本体の`ChakraProvider`配下には含まれないため、`startGoalMarkerElement.ts`と
 * 同様にChakra UIコンポーネントは使わずプレーンなDOM要素として組み立てる
 */
export const PhotoBalloonThumbnail = ({ photoId, fileName }: PhotoBalloonThumbnailProps) => {
  const { src, isLoaded, handleLoad, handleError } = usePhotoThumbnailFallback(photoId);

  return (
    <img
      src={src}
      alt={fileName}
      onLoad={handleLoad}
      onError={handleError}
      style={{
        width: PHOTO_BALLOON_THUMBNAIL_SIZE_PX,
        height: PHOTO_BALLOON_THUMBNAIL_SIZE_PX,
        objectFit: 'cover',
        borderRadius: '50%',
        border: '2px solid white',
        boxShadow: '0 0 4px rgba(0, 0, 0, 0.5)',
        visibility: isLoaded ? 'visible' : 'hidden'
      }}
    />
  );
};
