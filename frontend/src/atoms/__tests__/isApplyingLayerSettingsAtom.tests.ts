import { act, renderHook } from '@testing-library/react';
import { Provider as JotaiProvider, useAtomValue, useSetAtom } from 'jotai';
import { describe, expect, test } from 'vitest';
import {
  clearPendingLayerApplyFlagAtom,
  isApplyingLayerSettingsAtom,
  startPendingLayerApplyAtom
} from '../isApplyingLayerSettingsAtom';

const renderWithProvider = () =>
  renderHook(
    () => {
      const isApplyingLayerSettings = useAtomValue(isApplyingLayerSettingsAtom);
      const startPendingLayerApply = useSetAtom(startPendingLayerApplyAtom);
      const clearPendingLayerApplyFlag = useSetAtom(clearPendingLayerApplyFlagAtom);
      return { isApplyingLayerSettings, startPendingLayerApply, clearPendingLayerApplyFlag };
    },
    { wrapper: JotaiProvider }
  );

describe('isApplyingLayerSettingsAtomに関するテスト（PR #110レビュー対応）', () => {
  test('初期状態ではisApplyingLayerSettingsはfalseである', () => {
    const { result } = renderWithProvider();

    expect(result.current.isApplyingLayerSettings).toBe(false);
  });

  test('startPendingLayerApplyAtomでwaitingForAdminBoundaryのみtrueにすると、isApplyingLayerSettingsはtrueになる', () => {
    const { result } = renderWithProvider();

    act(() => {
      result.current.startPendingLayerApply({ waitingForAdminBoundary: true, waitingForCyclingLog: false });
    });

    expect(result.current.isApplyingLayerSettings).toBe(true);
  });

  test('startPendingLayerApplyAtomで両方falseにすると、isApplyingLayerSettingsはfalseのままである', () => {
    const { result } = renderWithProvider();

    act(() => {
      result.current.startPendingLayerApply({ waitingForAdminBoundary: false, waitingForCyclingLog: false });
    });

    expect(result.current.isApplyingLayerSettings).toBe(false);
  });

  test('両方待機中のとき、片方だけclearPendingLayerApplyFlagAtomで完了させても、isApplyingLayerSettingsはtrueのままである', () => {
    const { result } = renderWithProvider();
    act(() => {
      result.current.startPendingLayerApply({ waitingForAdminBoundary: true, waitingForCyclingLog: true });
    });

    act(() => {
      result.current.clearPendingLayerApplyFlag('waitingForCyclingLog');
    });

    expect(result.current.isApplyingLayerSettings).toBe(true);
  });

  test('両方待機中のとき、両方clearPendingLayerApplyFlagAtomで完了させると、isApplyingLayerSettingsはfalseになる', () => {
    const { result } = renderWithProvider();
    act(() => {
      result.current.startPendingLayerApply({ waitingForAdminBoundary: true, waitingForCyclingLog: true });
    });

    act(() => {
      result.current.clearPendingLayerApplyFlag('waitingForAdminBoundary');
      result.current.clearPendingLayerApplyFlag('waitingForCyclingLog');
    });

    expect(result.current.isApplyingLayerSettings).toBe(false);
  });

  test('開始前にclearPendingLayerApplyFlagAtomを呼んでもエラーにならず、isApplyingLayerSettingsはfalseのままである', () => {
    const { result } = renderWithProvider();

    act(() => {
      result.current.clearPendingLayerApplyFlag('waitingForAdminBoundary');
    });

    expect(result.current.isApplyingLayerSettings).toBe(false);
  });
});
