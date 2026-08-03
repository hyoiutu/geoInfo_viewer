import { describe, expect, test } from 'vitest';
import { clearPendingLayerApplyFlag } from '../pendingLayerApply';

describe('clearPendingLayerApplyFlagに関するテスト（PR #110レビュー対応）', () => {
  test('currentがnullでない場合、指定フィールドのみfalseにした新しいオブジェクトを返す', () => {
    const result = clearPendingLayerApplyFlag('waitingForAdminBoundary')({
      waitingForAdminBoundary: true,
      waitingForCyclingLog: true
    });

    expect(result).toEqual({ waitingForAdminBoundary: false, waitingForCyclingLog: true });
  });

  test('指定フィールド以外の値は変更しない', () => {
    const result = clearPendingLayerApplyFlag('waitingForCyclingLog')({
      waitingForAdminBoundary: true,
      waitingForCyclingLog: true
    });

    expect(result).toEqual({ waitingForAdminBoundary: true, waitingForCyclingLog: false });
  });

  test('currentがnullの場合、nullをそのまま返す', () => {
    const result = clearPendingLayerApplyFlag('waitingForAdminBoundary')(null);

    expect(result).toBeNull();
  });
});
