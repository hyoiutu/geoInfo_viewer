import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { resolvePhotoImageUrl, resolvePhotoThumbnailUrl } from '../../api/photosApi';
import { PhotoBalloonThumbnail } from '../PhotoBalloonThumbnail';

// PhotoBalloonThumbnailはmaplibregl.Marker用の独立したReact rootへマウントされChakraProvider配下に
// 含まれないコンポーネントのため、renderWithChakra（ChakraProviderでラップするヘルパー）ではなく
// 素のrenderを使い、実際の実行時環境（ChakraProviderの外）を再現する（PRレビュー対応）
describe('PhotoBalloonThumbnailに関するテスト（Issue #107）', () => {
  test('サムネイルURLで画像を表示する', () => {
    render(<PhotoBalloonThumbnail photoId={1} fileName="a.jpg" />);

    expect(screen.getByAltText('a.jpg')).toHaveAttribute('src', resolvePhotoThumbnailUrl(1));
  });

  test('サムネイルの読み込みに失敗した場合、フルサイズ画像のURLへフォールバックする', async () => {
    render(<PhotoBalloonThumbnail photoId={1} fileName="a.jpg" />);

    fireEvent.error(screen.getByAltText('a.jpg'));

    await waitFor(() => {
      expect(screen.getByAltText('a.jpg')).toHaveAttribute('src', resolvePhotoImageUrl(1));
    });
  });

  test('読み込み完了まではvisibility hiddenで非表示、読み込み完了後にvisibleへ切り替わる', () => {
    render(<PhotoBalloonThumbnail photoId={1} fileName="a.jpg" />);

    expect(screen.getByAltText('a.jpg')).toHaveStyle({ visibility: 'hidden' });

    fireEvent.load(screen.getByAltText('a.jpg'));

    expect(screen.getByAltText('a.jpg')).toHaveStyle({ visibility: 'visible' });
  });
});
