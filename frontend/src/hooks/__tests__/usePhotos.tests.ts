import { renderHook, waitFor } from '@testing-library/react';
import { Provider as JotaiProvider, useAtomValue } from 'jotai';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fetchPhotos } from '../../api/activitiesApi';
import { errorsAtom } from '../../atoms/errorsAtom';
import { usePhotos } from '../usePhotos';

vi.mock('../../api/activitiesApi', () => ({
  fetchPhotos: vi.fn()
}));

describe('usePhotosに関するテスト', () => {
  beforeEach(() => {
    vi.mocked(fetchPhotos).mockReset();
  });

  test('マウント時、指定したアクティビティIDで写真を取得する', async () => {
    const photos = [{ id: 1, fileName: 'a.jpg', takenAt: '2026-07-01T00:30:00.000Z', location: null }];
    vi.mocked(fetchPhotos).mockResolvedValue(photos);

    const { result } = renderHook(() => usePhotos('123'));

    await waitFor(() => {
      expect(result.current.photos).toEqual(photos);
    });
    expect(fetchPhotos).toHaveBeenCalledWith('123');
  });

  test('取得完了までisLoadingはtrue、完了後はfalseになる', async () => {
    vi.mocked(fetchPhotos).mockResolvedValue([]);

    const { result } = renderHook(() => usePhotos('123'));

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  test('activityIdが変わると再取得する', async () => {
    vi.mocked(fetchPhotos).mockResolvedValue([]);
    const { rerender } = renderHook(({ activityId }) => usePhotos(activityId), {
      initialProps: { activityId: '123' }
    });
    await waitFor(() => {
      expect(fetchPhotos).toHaveBeenCalledWith('123');
    });

    rerender({ activityId: '456' });

    await waitFor(() => {
      expect(fetchPhotos).toHaveBeenCalledWith('456');
    });
  });

  test('activityIdがnullの場合、取得を行わず空配列・isLoading falseを返す（Issue #107）', () => {
    const { result } = renderHook(() => usePhotos(null));

    expect(result.current.photos).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(fetchPhotos).not.toHaveBeenCalled();
  });

  test('activityIdがnullへ変わると、取得済みの写真をクリアする（Issue #107）', async () => {
    vi.mocked(fetchPhotos).mockResolvedValue([
      { id: 1, fileName: 'a.jpg', takenAt: '2026-07-01T00:30:00.000Z', location: null }
    ]);
    const { result, rerender } = renderHook(({ activityId }) => usePhotos(activityId), {
      // 型推論では'123'というリテラル型になり後続のrerender({activityId: null})を渡せなくなるため、
      // 意図した型（string | null）へ広げる
      initialProps: { activityId: '123' as string | null }
    });
    await waitFor(() => {
      expect(result.current.photos).toHaveLength(1);
    });

    rerender({ activityId: null });

    await waitFor(() => {
      expect(result.current.photos).toEqual([]);
    });
  });

  test('取得に失敗した場合、グローバルなエラースタックに追加する', async () => {
    vi.mocked(fetchPhotos).mockRejectedValue(new Error('fetch failed'));

    const { result } = renderHook(
      () => {
        usePhotos('123');
        return useAtomValue(errorsAtom);
      },
      { wrapper: JotaiProvider }
    );

    await waitFor(() => {
      expect(result.current).toEqual([expect.objectContaining({ message: 'fetch failed' })]);
    });
  });
});
