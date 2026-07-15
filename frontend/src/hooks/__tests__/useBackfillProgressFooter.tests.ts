import { act, renderHook } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import type { BackfillStatus } from '../../api/activitiesApi';
import { useBackfillProgressFooter } from '../useBackfillProgressFooter';

const NOT_RUNNING_STATUS: BackfillStatus = {
  isRunning: false,
  totalCount: 0,
  completedCount: 0,
  progressPercent: 0,
  estimatedRemainingSeconds: null,
  lastError: null
};

const RUNNING_STATUS: BackfillStatus = {
  isRunning: true,
  totalCount: 4,
  completedCount: 1,
  progressPercent: 25,
  estimatedRemainingSeconds: 27,
  lastError: null
};

describe('useBackfillProgressFooterに関するテスト', () => {
  test('backfillStatusがnull(未取得)の場合、フッターは表示されない', () => {
    const { result } = renderHook(() => useBackfillProgressFooter(null));

    expect(result.current.isVisible).toBe(false);
  });

  test('一度も実行されていない場合(isRunning:false)、フッターは表示されない', () => {
    const { result } = renderHook(() => useBackfillProgressFooter(NOT_RUNNING_STATUS));

    expect(result.current.isVisible).toBe(false);
  });

  test('実行中(isRunning:true)になると、フッターが表示される', () => {
    const { result, rerender } = renderHook(({ status }) => useBackfillProgressFooter(status), {
      initialProps: { status: NOT_RUNNING_STATUS as BackfillStatus | null }
    });

    rerender({ status: RUNNING_STATUS });

    expect(result.current.isVisible).toBe(true);
  });

  test('実行完了後(isRunning:falseに戻った後)も、dismissを呼ぶまでフッターは表示され続ける', () => {
    const { result, rerender } = renderHook(({ status }) => useBackfillProgressFooter(status), {
      initialProps: { status: NOT_RUNNING_STATUS as BackfillStatus | null }
    });
    rerender({ status: RUNNING_STATUS });

    rerender({ status: NOT_RUNNING_STATUS });

    expect(result.current.isVisible).toBe(true);
  });

  test('dismissを呼ぶと、フッターが非表示になる', () => {
    const { result, rerender } = renderHook(({ status }) => useBackfillProgressFooter(status), {
      initialProps: { status: NOT_RUNNING_STATUS as BackfillStatus | null }
    });
    rerender({ status: RUNNING_STATUS });
    rerender({ status: NOT_RUNNING_STATUS });

    act(() => {
      result.current.dismiss();
    });

    expect(result.current.isVisible).toBe(false);
  });

  test('dismiss後に再度実行されると、フッターが再表示される', () => {
    const { result, rerender } = renderHook(({ status }) => useBackfillProgressFooter(status), {
      initialProps: { status: NOT_RUNNING_STATUS as BackfillStatus | null }
    });
    rerender({ status: RUNNING_STATUS });
    rerender({ status: NOT_RUNNING_STATUS });
    act(() => {
      result.current.dismiss();
    });

    rerender({ status: RUNNING_STATUS });

    expect(result.current.isVisible).toBe(true);
  });
});
