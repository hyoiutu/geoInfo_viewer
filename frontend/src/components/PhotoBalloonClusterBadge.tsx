import { PHOTO_BALLOON_CLUSTER_BADGE_SIZE_PX } from '../constants/photoBalloon';

/** PhotoBalloonClusterBadgeのprops */
type PhotoBalloonClusterBadgeProps = {
  /** クラスタにまとまっている写真の件数 */
  photoCount: number;
};

/**
 * 近接する複数の写真をまとめたクラスタの吹き出し。個別のサムネイルは表示せず件数のみを表示する
 * （検討事項「写真が密集している区間で吹き出しが重なって見づらくなる」への対応、クラスタリングあり
 * で実装する旨のユーザー回答に基づく。Issue #107）。
 * `PhotoBalloonThumbnail`と同じ理由（`maplibregl.Marker`用の独立したReact rootへマウントされ
 * `ChakraProvider`配下に含まれないため）でChakra UIコンポーネントは使わずプレーンなDOM要素として組み立てる
 */
export const PhotoBalloonClusterBadge = ({ photoCount }: PhotoBalloonClusterBadgeProps) => (
  <div
    style={{
      width: PHOTO_BALLOON_CLUSTER_BADGE_SIZE_PX,
      height: PHOTO_BALLOON_CLUSTER_BADGE_SIZE_PX,
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--chakra-colors-blue-500, #3182ce)',
      color: 'white',
      border: '2px solid white',
      boxShadow: '0 0 4px rgba(0, 0, 0, 0.5)',
      fontWeight: 'bold',
      fontSize: '14px'
    }}
  >
    {photoCount}
  </div>
);
