import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { resolvePhotoImageUrl, resolvePhotoThumbnailUrl } from '../../api/photosApi';
import { renderWithChakra } from '../../test-utils/renderWithChakra';
import { PhotoBalloonThumbnail } from '../PhotoBalloonThumbnail';

describe('PhotoBalloonThumbnailに関するテスト（Issue #107）', () => {
  test('サムネイルURLで画像を表示する', () => {
    renderWithChakra(<PhotoBalloonThumbnail photoId={1} fileName="a.jpg" onClick={vi.fn()} />);

    expect(screen.getByAltText('a.jpg')).toHaveAttribute('src', resolvePhotoThumbnailUrl(1));
  });

  test('サムネイルの読み込みに失敗した場合、フルサイズ画像のURLへフォールバックする', async () => {
    renderWithChakra(<PhotoBalloonThumbnail photoId={1} fileName="a.jpg" onClick={vi.fn()} />);

    fireEvent.error(screen.getByAltText('a.jpg'));

    await waitFor(() => {
      expect(screen.getByAltText('a.jpg')).toHaveAttribute('src', resolvePhotoImageUrl(1));
    });
  });

  test('読み込み完了まではvisibility hiddenで非表示、読み込み完了後にvisibleへ切り替わる', () => {
    renderWithChakra(<PhotoBalloonThumbnail photoId={1} fileName="a.jpg" onClick={vi.fn()} />);

    expect(screen.getByAltText('a.jpg')).toHaveStyle({ visibility: 'hidden' });

    fireEvent.load(screen.getByAltText('a.jpg'));

    expect(screen.getByAltText('a.jpg')).toHaveStyle({ visibility: 'visible' });
  });

  test('クリックすると、onClickが呼ばれる（Issue #108）', () => {
    const onClick = vi.fn();
    renderWithChakra(<PhotoBalloonThumbnail photoId={1} fileName="a.jpg" onClick={onClick} />);

    fireEvent.click(screen.getByAltText('a.jpg'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
