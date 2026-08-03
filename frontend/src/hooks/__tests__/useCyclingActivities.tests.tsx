import { act, renderHook, waitFor } from '@testing-library/react';
import { Provider as JotaiProvider, useAtomValue } from 'jotai';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fetchCyclingActivities, getBackfillStatus, syncCyclingActivities } from '../../api/activitiesApi';
import { errorsAtom } from '../../atoms/errorsAtom';
import { useCyclingActivities } from '../useCyclingActivities';

/** useCyclingActivitiesとerrorsAtomの現在値を合わせて返す、テスト用の合成フック */
const useCyclingActivitiesWithErrors = (onSyncComplete?: () => void) => ({
  cyclingActivities: useCyclingActivities(onSyncComplete),
  errors: useAtomValue(errorsAtom)
});

vi.mock('../../api/activitiesApi', () => ({
  fetchCyclingActivities: vi.fn(),
  syncCyclingActivities: vi.fn(),
  getBackfillStatus: vi.fn()
}));

const NOT_RUNNING_BACKFILL_STATUS = {
  isRunning: false,
  totalCount: 0,
  completedCount: 0,
  progressPercent: 0,
  estimatedRemainingSeconds: null,
  lastError: null
};

const ACTIVITY_1 = {
  id: '1',
  name: 'ライド1',
  distanceMeters: 1000,
  movingTimeSeconds: 600,
  elapsedTimeSeconds: 650,
  elevationGainMeters: 50,
  startDate: '2026-07-01T00:00:00Z',
  path: null,
  summaryPath: null
};

const renderCyclingActivities = (onSyncComplete?: () => void) =>
  renderHook(() => useCyclingActivitiesWithErrors(onSyncComplete), {
    wrapper: ({ children }) => <JotaiProvider>{children}</JotaiProvider>
  });

describe('useCyclingActivitiesに関するテスト（Issue #125）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchCyclingActivities).mockResolvedValue([]);
    vi.mocked(syncCyclingActivities).mockResolvedValue({ success: true });
    vi.mocked(getBackfillStatus).mockResolvedValue(NOT_RUNNING_BACKFILL_STATUS);
  });

  test('初期状態はactivitiesが空配列である', () => {
    const { result } = renderCyclingActivities();

    expect(result.current.cyclingActivities.activities).toEqual([]);
  });

  test('syncAndLoadBicycleLogを呼ぶと、同期後に取得したアクティビティを返す', async () => {
    vi.mocked(fetchCyclingActivities).mockResolvedValue([ACTIVITY_1]);
    const { result } = renderCyclingActivities();

    await act(async () => {
      await result.current.cyclingActivities.syncAndLoadBicycleLog();
    });

    expect(syncCyclingActivities).toHaveBeenCalledTimes(1);
    expect(result.current.cyclingActivities.activities).toEqual([ACTIVITY_1]);
  });

  test('同期に失敗した場合は参照APIを呼ばない', async () => {
    vi.mocked(syncCyclingActivities).mockResolvedValue({ success: false });
    const { result } = renderCyclingActivities();

    await act(async () => {
      await result.current.cyclingActivities.syncAndLoadBicycleLog();
    });

    expect(syncCyclingActivities).toHaveBeenCalledTimes(1);
    expect(fetchCyclingActivities).not.toHaveBeenCalled();
  });

  test('初期取り込み実行中の場合は同期用APIを呼ばず取得済み分のみ表示する', async () => {
    vi.mocked(getBackfillStatus).mockResolvedValue({
      isRunning: true,
      totalCount: 4,
      completedCount: 1,
      progressPercent: 25,
      estimatedRemainingSeconds: 27,
      lastError: null
    });
    const { result } = renderCyclingActivities();

    await act(async () => {
      await result.current.cyclingActivities.syncAndLoadBicycleLog();
    });

    expect(fetchCyclingActivities).toHaveBeenCalledTimes(1);
    expect(syncCyclingActivities).not.toHaveBeenCalled();
  });

  test('syncAndLoadBicycleLogを複数回呼ぶと、呼んだ回数だけ同期用APIが呼ばれる', async () => {
    const { result } = renderCyclingActivities();

    await act(async () => {
      await result.current.cyclingActivities.syncAndLoadBicycleLog();
    });
    await act(async () => {
      await result.current.cyclingActivities.syncAndLoadBicycleLog();
    });

    expect(syncCyclingActivities).toHaveBeenCalledTimes(2);
  });

  test('同期用APIの呼び出しが失敗した場合、グローバルなエラースタックに追加される', async () => {
    vi.mocked(syncCyclingActivities).mockRejectedValue(new Error('sync failed'));
    const { result } = renderCyclingActivities();

    await act(async () => {
      await result.current.cyclingActivities.syncAndLoadBicycleLog();
    });

    await waitFor(() => {
      expect(result.current.errors.some((error) => error.message === 'sync failed')).toBe(true);
    });
    expect(fetchCyclingActivities).not.toHaveBeenCalled();
  });

  test('参照用APIの呼び出しが失敗した場合、グローバルなエラースタックに追加される', async () => {
    vi.mocked(fetchCyclingActivities).mockRejectedValue(new Error('fetch failed'));
    const { result } = renderCyclingActivities();

    await act(async () => {
      await result.current.cyclingActivities.syncAndLoadBicycleLog();
    });

    await waitFor(() => {
      expect(result.current.errors.some((error) => error.message === 'fetch failed')).toBe(true);
    });
  });

  describe('onSyncCompleteに関するテスト（Issue #65）', () => {
    test('同期・参照が完了すると、onSyncCompleteが呼ばれる', async () => {
      const onSyncComplete = vi.fn();
      const { result } = renderCyclingActivities(onSyncComplete);

      await act(async () => {
        await result.current.cyclingActivities.syncAndLoadBicycleLog();
      });

      expect(onSyncComplete).toHaveBeenCalledTimes(1);
    });

    test('同期用APIの呼び出しが失敗した場合でも、onSyncCompleteは呼ばれる（ダイアログが閉じなくならないようにするため）', async () => {
      vi.mocked(syncCyclingActivities).mockRejectedValue(new Error('sync failed'));
      const onSyncComplete = vi.fn();
      const { result } = renderCyclingActivities(onSyncComplete);

      await act(async () => {
        await result.current.cyclingActivities.syncAndLoadBicycleLog();
      });

      expect(onSyncComplete).toHaveBeenCalledTimes(1);
    });

    test('参照用APIの呼び出しが失敗した場合でも、onSyncCompleteは呼ばれる', async () => {
      vi.mocked(fetchCyclingActivities).mockRejectedValue(new Error('fetch failed'));
      const onSyncComplete = vi.fn();
      const { result } = renderCyclingActivities(onSyncComplete);

      await act(async () => {
        await result.current.cyclingActivities.syncAndLoadBicycleLog();
      });

      expect(onSyncComplete).toHaveBeenCalledTimes(1);
    });

    test('onSyncCompleteが指定されていなくてもエラーにならない', async () => {
      const { result } = renderCyclingActivities();

      await act(async () => {
        await result.current.cyclingActivities.syncAndLoadBicycleLog();
      });

      expect(syncCyclingActivities).toHaveBeenCalledTimes(1);
    });
  });
});
