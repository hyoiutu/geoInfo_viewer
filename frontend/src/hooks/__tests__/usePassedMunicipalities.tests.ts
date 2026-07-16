import { renderHook, waitFor } from '@testing-library/react';
import { Provider as JotaiProvider, useAtomValue } from 'jotai';
import { describe, expect, test, vi } from 'vitest';
import { fetchPassedMunicipalities } from '../../api/activitiesApi';
import { errorsAtom } from '../../atoms/errorsAtom';
import type { MunicipalityEra } from '../../types/municipalityEra';
import { usePassedMunicipalities } from '../usePassedMunicipalities';

vi.mock('../../api/activitiesApi', () => ({
  fetchPassedMunicipalities: vi.fn()
}));

describe('usePassedMunicipalitiesに関するテスト', () => {
  test('マウント時、指定したアクティビティID・年代(省略時は現行)で通過自治体を取得する', async () => {
    const municipalities = [{ prefectureName: '東京都', municipalityName: '千代田区' }];
    vi.mocked(fetchPassedMunicipalities).mockResolvedValue(municipalities);

    const { result } = renderHook(() => usePassedMunicipalities('123'));

    await waitFor(() => {
      expect(result.current.municipalities).toEqual(municipalities);
    });
    expect(fetchPassedMunicipalities).toHaveBeenCalledWith('123', 'current');
  });

  test('年代を指定した場合、その年代で通過自治体を取得する', async () => {
    vi.mocked(fetchPassedMunicipalities).mockResolvedValue([]);

    renderHook(() => usePassedMunicipalities('123', '2000-10-01'));

    await waitFor(() => {
      expect(fetchPassedMunicipalities).toHaveBeenCalledWith('123', '2000-10-01');
    });
  });

  test('年代が変わると再取得する', async () => {
    vi.mocked(fetchPassedMunicipalities).mockResolvedValue([]);
    const { rerender } = renderHook(({ era }: { era: MunicipalityEra }) => usePassedMunicipalities('123', era), {
      initialProps: { era: 'current' }
    });
    await waitFor(() => {
      expect(fetchPassedMunicipalities).toHaveBeenCalledWith('123', 'current');
    });

    rerender({ era: '2000-10-01' });

    await waitFor(() => {
      expect(fetchPassedMunicipalities).toHaveBeenCalledWith('123', '2000-10-01');
    });
  });

  test('取得完了までisLoadingはtrue、完了後はfalseになる', async () => {
    vi.mocked(fetchPassedMunicipalities).mockResolvedValue([]);

    const { result } = renderHook(() => usePassedMunicipalities('123'));

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  test('activityIdが変わると再取得する', async () => {
    vi.mocked(fetchPassedMunicipalities).mockResolvedValue([]);
    const { rerender } = renderHook(({ activityId }) => usePassedMunicipalities(activityId), {
      initialProps: { activityId: '123' }
    });
    await waitFor(() => {
      expect(fetchPassedMunicipalities).toHaveBeenCalledWith('123', 'current');
    });

    rerender({ activityId: '456' });

    await waitFor(() => {
      expect(fetchPassedMunicipalities).toHaveBeenCalledWith('456', 'current');
    });
  });

  test('取得に失敗した場合、グローバルなエラースタックに追加する', async () => {
    vi.mocked(fetchPassedMunicipalities).mockRejectedValue(new Error('fetch failed'));

    const { result } = renderHook(
      () => {
        usePassedMunicipalities('123');
        return useAtomValue(errorsAtom);
      },
      { wrapper: JotaiProvider }
    );

    await waitFor(() => {
      expect(result.current).toEqual([expect.objectContaining({ message: 'fetch failed' })]);
    });
  });
});
