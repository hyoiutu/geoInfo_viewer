import { renderHook, waitFor } from '@testing-library/react';
import { Provider as JotaiProvider, useAtomValue } from 'jotai';
import { describe, expect, test, vi } from 'vitest';
import { fetchPhotos } from '../../api/activitiesApi';
import { errorsAtom } from '../../atoms/errorsAtom';
import { usePhotos } from '../usePhotos';

vi.mock('../../api/activitiesApi', () => ({
  fetchPhotos: vi.fn()
}));

describe('usePhotosに関するテスト', () => {
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
