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
// renderHookのinitialPropsはこの変数の型からhookの引数型を推論するため、NOT_RUNNING_STATUSをそのまま渡すと
// BackfillStatus型に固定され、後続のrerenderでnullを渡すテストが型エラーになる。あらかじめ|null込みの型で持つ
const NOT_RUNNING_STATUS_OR_NULL: BackfillStatus | null = NOT_RUNNING_STATUS;

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
      initialProps: { status: NOT_RUNNING_STATUS_OR_NULL }
    });

    rerender({ status: RUNNING_STATUS });

    expect(result.current.isVisible).toBe(true);
  });

  test('実行完了後(isRunning:falseに戻った後)も、dismissを呼ぶまでフッターは表示され続ける', () => {
    const { result, rerender } = renderHook(({ status }) => useBackfillProgressFooter(status), {
      initialProps: { status: NOT_RUNNING_STATUS_OR_NULL }
    });
    rerender({ status: RUNNING_STATUS });

    rerender({ status: NOT_RUNNING_STATUS });

    expect(result.current.isVisible).toBe(true);
  });

  test('dismissを呼ぶと、フッターが非表示になる', () => {
    const { result, rerender } = renderHook(({ status }) => useBackfillProgressFooter(status), {
      initialProps: { status: NOT_RUNNING_STATUS_OR_NULL }
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
      initialProps: { status: NOT_RUNNING_STATUS_OR_NULL }
    });
    rerender({ status: RUNNING_STATUS });
    rerender({ status: NOT_RUNNING_STATUS });
    act(() => {
      result.current.dismiss();
    });

    rerender({ status: RUNNING_STATUS });

    expect(result.current.isVisible).toBe(true);
  });

  describe('showに関するテスト（Issue #86）', () => {
    test('showを呼ぶと、backfillStatusがisRunning:trueを一度も経由しなくてもフッターが表示される', () => {
      // E2E環境等、対象件数が極端に少ない・レート制限間隔が極小の場合、開始直後の最初の状態取得時点で
      // 既に完了していることがあり、isRunning:trueの状態を一度もフロントエンドが観測できないことがある
      // (Issue #86で判明。開始操作の直後にbackfillStatusがnull→isRunning:falseへ直接遷移するケース)。
      // isRunning:trueの観測に頼らず、開始操作そのものをトリガーとして表示できる必要がある
      const { result, rerender } = renderHook(({ status }) => useBackfillProgressFooter(status), {
        initialProps: { status: NOT_RUNNING_STATUS_OR_NULL }
      });

      act(() => {
        result.current.show();
      });

      expect(result.current.isVisible).toBe(true);

      // isRunning:trueを経由せず、直接「完了済み」状態へ遷移しても表示され続ける
      rerender({ status: { ...NOT_RUNNING_STATUS, completedCount: 3, totalCount: 3 } });

      expect(result.current.isVisible).toBe(true);
    });

    test('showを呼んだ後にdismissを呼ぶと、フッターが非表示になる', () => {
      const { result } = renderHook(() => useBackfillProgressFooter(null));

      act(() => {
        result.current.show();
      });
      act(() => {
        result.current.dismiss();
      });

      expect(result.current.isVisible).toBe(false);
    });
  });
});
