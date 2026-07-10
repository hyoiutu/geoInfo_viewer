import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { getBackfillStatus, startBackfill } from '../../api/activitiesApi';
import { useBackfillStatus } from '../useBackfillStatus';

vi.mock('../../api/activitiesApi', () => ({
  getBackfillStatus: vi.fn(),
  startBackfill: vi.fn()
}));

const NOT_RUNNING_STATUS = {
  isRunning: false,
  totalCount: 0,
  completedCount: 0,
  progressPercent: 0,
  estimatedRemainingSeconds: null
};

const RUNNING_STATUS = {
  isRunning: true,
  totalCount: 4,
  completedCount: 1,
  progressPercent: 25,
  estimatedRemainingSeconds: 27
};

describe('useBackfillStatusに関するテスト', () => {
  beforeEach(() => {
    vi.mocked(getBackfillStatus).mockResolvedValue(NOT_RUNNING_STATUS);
    vi.mocked(startBackfill).mockResolvedValue({ started: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('マウント時に状態を取得する', async () => {
    const { result } = renderHook(() => useBackfillStatus());

    await waitFor(() => {
      expect(result.current.backfillStatus).toEqual(NOT_RUNNING_STATUS);
    });
  });

  test('startを呼ぶとstartBackfillを呼び出し、その後状態を再取得する', async () => {
    const { result } = renderHook(() => useBackfillStatus());
    await waitFor(() => {
      expect(result.current.backfillStatus).toEqual(NOT_RUNNING_STATUS);
    });
    vi.mocked(getBackfillStatus).mockResolvedValue(RUNNING_STATUS);

    await act(async () => {
      await result.current.start();
    });

    expect(startBackfill).toHaveBeenCalledTimes(1);
    expect(result.current.backfillStatus).toEqual(RUNNING_STATUS);
  });

  test('実行中はポーリングして状態を更新する', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(getBackfillStatus).mockResolvedValue(RUNNING_STATUS);
    const { result } = renderHook(() => useBackfillStatus());
    await waitFor(() => {
      expect(result.current.backfillStatus).toEqual(RUNNING_STATUS);
    });
    vi.mocked(getBackfillStatus).mockResolvedValue(NOT_RUNNING_STATUS);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(result.current.backfillStatus).toEqual(NOT_RUNNING_STATUS);
  });

  test('実行中でない場合はポーリングしない', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result } = renderHook(() => useBackfillStatus());
    await waitFor(() => {
      expect(result.current.backfillStatus).toEqual(NOT_RUNNING_STATUS);
    });
    vi.mocked(getBackfillStatus).mockClear();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    expect(getBackfillStatus).not.toHaveBeenCalled();
  });
});
