import { act, renderHook, waitFor } from '@testing-library/react';
import { Provider as JotaiProvider, useAtomValue } from 'jotai';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { getBackfillStatus, startBackfill, startForceRefetch } from '../../api/activitiesApi';
import { errorsAtom } from '../../atoms/errorsAtom';
import { useBackfillStatus } from '../useBackfillStatus';

/** useBackfillStatusとerrorsAtomの現在値を合わせて返す、テスト用の合成フック */
const useBackfillStatusWithErrors = () => ({
  backfillStatus: useBackfillStatus(),
  errors: useAtomValue(errorsAtom)
});

vi.mock('../../api/activitiesApi', () => ({
  getBackfillStatus: vi.fn(),
  startBackfill: vi.fn(),
  startForceRefetch: vi.fn()
}));

const NOT_RUNNING_STATUS = {
  isRunning: false,
  totalCount: 0,
  completedCount: 0,
  progressPercent: 0,
  estimatedRemainingSeconds: null,
  lastError: null
};

const RUNNING_STATUS = {
  isRunning: true,
  totalCount: 4,
  completedCount: 1,
  progressPercent: 25,
  estimatedRemainingSeconds: 27,
  lastError: null
};

describe('useBackfillStatusに関するテスト', () => {
  beforeEach(() => {
    vi.mocked(getBackfillStatus).mockResolvedValue(NOT_RUNNING_STATUS);
    vi.mocked(startBackfill).mockResolvedValue({ started: true });
    vi.mocked(startForceRefetch).mockResolvedValue({ started: true });
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

  test('状態取得に失敗した場合、グローバルなエラースタックに追加する', async () => {
    vi.mocked(getBackfillStatus).mockRejectedValue(new Error('network error'));

    const { result } = renderHook(useBackfillStatusWithErrors, { wrapper: JotaiProvider });

    await waitFor(() => {
      expect(result.current.errors).toEqual([expect.objectContaining({ message: 'network error' })]);
    });
  });

  test('startBackfillに失敗した場合、グローバルなエラースタックに追加する', async () => {
    vi.mocked(startBackfill).mockRejectedValue(new Error('backfill start failed'));
    const { result } = renderHook(useBackfillStatusWithErrors, { wrapper: JotaiProvider });
    await waitFor(() => {
      expect(result.current.backfillStatus.backfillStatus).toEqual(NOT_RUNNING_STATUS);
    });

    await act(async () => {
      await result.current.backfillStatus.start();
    });

    expect(result.current.errors).toEqual([expect.objectContaining({ message: 'backfill start failed' })]);
  });

  test('取得結果にlastErrorが含まれる場合、グローバルなエラースタックに追加する', async () => {
    const lastError = { errorCode: 'STRAVA_API_ERROR' as const, message: 'Strava APIエラー', hint: null };
    vi.mocked(getBackfillStatus).mockResolvedValue({ ...NOT_RUNNING_STATUS, lastError });

    const { result } = renderHook(useBackfillStatusWithErrors, { wrapper: JotaiProvider });

    await waitFor(() => {
      expect(result.current.errors).toEqual([lastError]);
    });
  });

  test('startForceRefetchを呼ぶとstartForceRefetch APIを呼び出し、その後状態を再取得する', async () => {
    const { result } = renderHook(() => useBackfillStatus());
    await waitFor(() => {
      expect(result.current.backfillStatus).toEqual(NOT_RUNNING_STATUS);
    });
    vi.mocked(getBackfillStatus).mockResolvedValue(RUNNING_STATUS);

    await act(async () => {
      await result.current.startForceRefetch();
    });

    expect(startForceRefetch).toHaveBeenCalledTimes(1);
    expect(result.current.backfillStatus).toEqual(RUNNING_STATUS);
  });

  test('startForceRefetchに失敗した場合、グローバルなエラースタックに追加する', async () => {
    vi.mocked(startForceRefetch).mockRejectedValue(new Error('force refetch start failed'));
    const { result } = renderHook(useBackfillStatusWithErrors, { wrapper: JotaiProvider });
    await waitFor(() => {
      expect(result.current.backfillStatus.backfillStatus).toEqual(NOT_RUNNING_STATUS);
    });

    await act(async () => {
      await result.current.backfillStatus.startForceRefetch();
    });

    expect(result.current.errors).toEqual([expect.objectContaining({ message: 'force refetch start failed' })]);
  });

  test('取得結果のlastErrorがnullの場合、エラースタックに追加しない', async () => {
    const { result } = renderHook(useBackfillStatusWithErrors, { wrapper: JotaiProvider });

    await waitFor(() => {
      expect(getBackfillStatus).toHaveBeenCalled();
    });
    expect(result.current.errors).toEqual([]);
  });
});
