import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { Photo } from '../../api/activitiesApi';
import { resolvePhotoImageUrl } from '../../api/photosApi';
import { renderWithChakra } from '../../test-utils/renderWithChakra';
import { PhotoPreviewModal } from '../PhotoPreviewModal';

const createPhoto = (overrides: Partial<Photo>): Photo => ({
  id: 1,
  fileName: 'a.jpg',
  takenAt: '2026-07-01T00:00:00.000Z',
  location: null,
  ...overrides
});

describe('PhotoPreviewModalに関するテスト（Issue #108）', () => {
  test('selectedIndexがnullの場合、ダイアログを表示しない', () => {
    renderWithChakra(
      <PhotoPreviewModal photos={[createPhoto({})]} selectedIndex={null} onClose={vi.fn()} onNavigate={vi.fn()} />
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('selectedIndexで指定した写真のフルサイズ画像を表示する', () => {
    const photos = [createPhoto({ id: 1, fileName: 'a.jpg' }), createPhoto({ id: 2, fileName: 'b.jpg' })];

    renderWithChakra(<PhotoPreviewModal photos={photos} selectedIndex={1} onClose={vi.fn()} onNavigate={vi.fn()} />);

    expect(screen.getByAltText('b.jpg')).toHaveAttribute('src', resolvePhotoImageUrl(2));
  });

  test('次の写真ボタンをクリックすると、次のindexでonNavigateが呼ばれる', () => {
    const photos = [createPhoto({ id: 1 }), createPhoto({ id: 2 })];
    const onNavigate = vi.fn();

    renderWithChakra(<PhotoPreviewModal photos={photos} selectedIndex={0} onClose={vi.fn()} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole('button', { name: '次の写真' }));

    expect(onNavigate).toHaveBeenCalledWith(1);
  });

  test('前の写真ボタンをクリックすると、前のindexでonNavigateが呼ばれる', () => {
    const photos = [createPhoto({ id: 1 }), createPhoto({ id: 2 })];
    const onNavigate = vi.fn();

    renderWithChakra(<PhotoPreviewModal photos={photos} selectedIndex={1} onClose={vi.fn()} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole('button', { name: '前の写真' }));

    expect(onNavigate).toHaveBeenCalledWith(0);
  });

  test('先頭の写真では前の写真ボタンが無効になる', () => {
    const photos = [createPhoto({ id: 1 }), createPhoto({ id: 2 })];

    renderWithChakra(<PhotoPreviewModal photos={photos} selectedIndex={0} onClose={vi.fn()} onNavigate={vi.fn()} />);

    expect(screen.getByRole('button', { name: '前の写真' })).toBeDisabled();
  });

  test('末尾の写真では次の写真ボタンが無効になる', () => {
    const photos = [createPhoto({ id: 1 }), createPhoto({ id: 2 })];

    renderWithChakra(<PhotoPreviewModal photos={photos} selectedIndex={1} onClose={vi.fn()} onNavigate={vi.fn()} />);

    expect(screen.getByRole('button', { name: '次の写真' })).toBeDisabled();
  });

  test('右矢印キーを押すと、次のindexでonNavigateが呼ばれる', () => {
    const photos = [createPhoto({ id: 1 }), createPhoto({ id: 2 })];
    const onNavigate = vi.fn();

    renderWithChakra(<PhotoPreviewModal photos={photos} selectedIndex={0} onClose={vi.fn()} onNavigate={onNavigate} />);
    fireEvent.keyDown(window, { key: 'ArrowRight' });

    expect(onNavigate).toHaveBeenCalledWith(1);
  });

  test('左矢印キーを押すと、前のindexでonNavigateが呼ばれる', () => {
    const photos = [createPhoto({ id: 1 }), createPhoto({ id: 2 })];
    const onNavigate = vi.fn();

    renderWithChakra(<PhotoPreviewModal photos={photos} selectedIndex={1} onClose={vi.fn()} onNavigate={onNavigate} />);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });

    expect(onNavigate).toHaveBeenCalledWith(0);
  });

  test('先頭の写真で左矢印キーを押しても、onNavigateは呼ばれない', () => {
    const photos = [createPhoto({ id: 1 }), createPhoto({ id: 2 })];
    const onNavigate = vi.fn();

    renderWithChakra(<PhotoPreviewModal photos={photos} selectedIndex={0} onClose={vi.fn()} onNavigate={onNavigate} />);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });

    expect(onNavigate).not.toHaveBeenCalled();
  });

  test('閉じる(×)ボタンをクリックすると、onCloseが呼ばれる', () => {
    const onClose = vi.fn();

    renderWithChakra(
      <PhotoPreviewModal photos={[createPhoto({})]} selectedIndex={0} onClose={onClose} onNavigate={vi.fn()} />
    );
    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
