import { act, renderHook } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { DEFAULT_ACTIVITY_FILTER } from '../../types/activityFilter';
import { useActivityFilter } from '../useActivityFilter';

describe('useActivityFilterに関するテスト', () => {
  test('初期状態では、適用中フィルタ・入力中フィルタともにデフォルト値で、ダイアログは閉じている', () => {
    const { result } = renderHook(() => useActivityFilter());

    expect(result.current.appliedFilter).toEqual(DEFAULT_ACTIVITY_FILTER);
    expect(result.current.draftFilter).toEqual(DEFAULT_ACTIVITY_FILTER);
    expect(result.current.isDialogOpen).toBe(false);
  });

  test('openDialogを呼ぶと、ダイアログが開く', () => {
    const { result } = renderHook(() => useActivityFilter());

    act(() => {
      result.current.openDialog();
    });

    expect(result.current.isDialogOpen).toBe(true);
  });

  test('openDialogを呼ぶと、入力中フィルタが現在適用中の内容にリセットされる', () => {
    const { result } = renderHook(() => useActivityFilter());
    act(() => {
      result.current.updateDraft({ minDistanceKm: 10 });
    });
    act(() => {
      result.current.applyDraft();
    });
    act(() => {
      result.current.updateDraft({ minDistanceKm: 999 });
    });
    act(() => {
      result.current.closeDialog();
    });

    act(() => {
      result.current.openDialog();
    });

    expect(result.current.draftFilter).toEqual({ ...DEFAULT_ACTIVITY_FILTER, minDistanceKm: 10 });
  });

  test('closeDialogを呼ぶと、入力中の内容を破棄してダイアログが閉じ、適用中フィルタは変化しない', () => {
    const { result } = renderHook(() => useActivityFilter());
    act(() => {
      result.current.openDialog();
      result.current.updateDraft({ minDistanceKm: 10 });
    });

    act(() => {
      result.current.closeDialog();
    });

    expect(result.current.isDialogOpen).toBe(false);
    expect(result.current.appliedFilter).toEqual(DEFAULT_ACTIVITY_FILTER);
  });

  test('updateDraftを呼ぶと、指定したフィールドのみ入力中フィルタが更新される', () => {
    const { result } = renderHook(() => useActivityFilter());

    act(() => {
      result.current.updateDraft({ minDistanceKm: 10 });
      result.current.updateDraft({ minElevationGainMeters: 100 });
    });

    expect(result.current.draftFilter).toEqual({
      ...DEFAULT_ACTIVITY_FILTER,
      minDistanceKm: 10,
      minElevationGainMeters: 100
    });
  });

  test('resetDraftを呼ぶと、入力中フィルタがデフォルト値に戻る（適用中フィルタは変化しない）', () => {
    const { result } = renderHook(() => useActivityFilter());
    act(() => {
      result.current.updateDraft({ minDistanceKm: 10 });
    });
    act(() => {
      result.current.applyDraft();
    });
    act(() => {
      result.current.openDialog();
    });

    act(() => {
      result.current.resetDraft();
    });

    expect(result.current.draftFilter).toEqual(DEFAULT_ACTIVITY_FILTER);
    expect(result.current.appliedFilter).toEqual({ ...DEFAULT_ACTIVITY_FILTER, minDistanceKm: 10 });
  });

  test('applyDraftを呼ぶと、入力中フィルタが適用中フィルタへ反映され、ダイアログが閉じる', () => {
    const { result } = renderHook(() => useActivityFilter());
    act(() => {
      result.current.openDialog();
      result.current.updateDraft({ minAverageSpeedKmh: 20 });
    });

    act(() => {
      result.current.applyDraft();
    });

    expect(result.current.appliedFilter).toEqual({ ...DEFAULT_ACTIVITY_FILTER, minAverageSpeedKmh: 20 });
    expect(result.current.isDialogOpen).toBe(false);
  });
});
