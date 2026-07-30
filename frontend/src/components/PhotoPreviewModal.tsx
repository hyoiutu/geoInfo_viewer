import { Box, IconButton, Image, Spinner } from '@chakra-ui/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Photo } from '../api/activitiesApi';
import { resolvePhotoImageUrl } from '../api/photosApi';
import { AppDialog } from './AppDialog';

const PREVIOUS_BUTTON_LABEL = '前の写真';
const NEXT_BUTTON_LABEL = '次の写真';
const NAVIGATION_STEP = 1;
const KEY_ARROW_LEFT = 'ArrowLeft';
const KEY_ARROW_RIGHT = 'ArrowRight';

/** PhotoPreviewModalのprops */
type PhotoPreviewModalProps = {
  /** 前後移動の対象となる写真一覧（アクティビティパネル・吹き出しで共通のものを渡す） */
  photos: Photo[];
  /** 表示中の写真のphotos内でのindex。未表示の場合はnull */
  selectedIndex: number | null;
  /** ダイアログを閉じるときに呼ばれるコールバック */
  onClose: () => void;
  /** 前後移動時に、移動先のindexを渡して呼ばれるコールバック */
  onNavigate: (index: number) => void;
};

/**
 * アクティビティパネル（`PhotoGridItem`）・地図上の吹き出し（`PhotoBalloonThumbnail`）いずれの
 * サムネイルをクリックした場合も表示する、写真の拡大プレビューダイアログ。フルサイズ画像
 * （`/photos/:id/image`。Issue #106のHEIC事前変換が完了していればJPEG化済みのものが返る）を取得して表示する。
 * 両方のクリック元で見た目・挙動を共通化する（Issue #108のユーザー回答）ため、呼び出し元
 * （`MapWorkspace.tsx`）で1つだけ持つ想定
 * @param photos 前後移動の対象となる写真一覧
 * @param selectedIndex 表示中の写真のindex
 */
export const PhotoPreviewModal = ({ photos, selectedIndex, onClose, onNavigate }: PhotoPreviewModalProps) => {
  const isOpen = selectedIndex !== null;
  const photo = selectedIndex !== null ? photos[selectedIndex] : undefined;
  const hasPrevious = selectedIndex !== null && selectedIndex > 0;
  const hasNext = selectedIndex !== null && selectedIndex < photos.length - NAVIGATION_STEP;

  // 矢印キーでの前後移動（Issue #108のユーザー回答）。ダイアログが開いている間のみ有効にする
  useEffect(() => {
    if (!isOpen || selectedIndex === null) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === KEY_ARROW_LEFT && hasPrevious) {
        onNavigate(selectedIndex - NAVIGATION_STEP);
      } else if (event.key === KEY_ARROW_RIGHT && hasNext) {
        onNavigate(selectedIndex + NAVIGATION_STEP);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, hasPrevious, hasNext, onNavigate]);

  return (
    <AppDialog isOpen={isOpen} onClose={onClose} title={photo?.fileName ?? ''}>
      {photo && (
        <Box position="relative" display="flex" alignItems="center" justifyContent="center" gap="2">
          <IconButton
            onClick={() => selectedIndex !== null && onNavigate(selectedIndex - NAVIGATION_STEP)}
            aria-label={PREVIOUS_BUTTON_LABEL}
            disabled={!hasPrevious}
            variant="ghost"
          >
            <ChevronLeft />
          </IconButton>
          <PhotoPreviewImage key={photo.id} photo={photo} />
          <IconButton
            onClick={() => selectedIndex !== null && onNavigate(selectedIndex + NAVIGATION_STEP)}
            aria-label={NEXT_BUTTON_LABEL}
            disabled={!hasNext}
            variant="ghost"
          >
            <ChevronRight />
          </IconButton>
        </Box>
      )}
    </AppDialog>
  );
};

/** PhotoPreviewImageのprops */
type PhotoPreviewImageProps = {
  /** 表示対象の写真 */
  photo: Photo;
};

/**
 * フルサイズ画像1件分。読み込み中はローディングアイコンを表示する。`key={photo.id}`で写真ごとに
 * 再マウントさせることで、前後移動のたびに読み込み状態をリセットする（呼び出し元参照）
 */
const PhotoPreviewImage = ({ photo }: PhotoPreviewImageProps) => {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <Box position="relative" width="100%" minHeight="60vh" display="flex" alignItems="center" justifyContent="center">
      <Image
        src={resolvePhotoImageUrl(photo.id)}
        alt={photo.fileName}
        maxHeight="80vh"
        maxWidth="100%"
        objectFit="contain"
        visibility={isLoaded ? 'visible' : 'hidden'}
        onLoad={() => setIsLoaded(true)}
        onError={() => setIsLoaded(true)}
      />
      {!isLoaded && (
        <Box position="absolute" inset="0" display="flex" alignItems="center" justifyContent="center">
          <Spinner size="lg" />
        </Box>
      )}
    </Box>
  );
};
