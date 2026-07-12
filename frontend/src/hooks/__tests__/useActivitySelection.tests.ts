import { act, renderHook } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { useActivitySelection } from '../useActivitySelection';

describe('useActivitySelectionに関するテスト', () => {
  test('初期状態では選択・フォーカスともに無い', () => {
    const { result } = renderHook(() => useActivitySelection());

    expect(result.current.selectedIds).toEqual([]);
    expect(result.current.focusedIndex).toBeNull();
  });

  test('selectActivitiesを呼ぶと、指定したID一覧が選択される', () => {
    const { result } = renderHook(() => useActivitySelection());

    act(() => {
      result.current.selectActivities(['1', '2']);
    });

    expect(result.current.selectedIds).toEqual(['1', '2']);
  });

  test('selectActivitiesを複数回呼ぶと、既存の選択が新しいID一覧で置き換わる（累積しない）', () => {
    const { result } = renderHook(() => useActivitySelection());
    act(() => {
      result.current.selectActivities(['1']);
    });

    act(() => {
      result.current.selectActivities(['2', '3']);
    });

    expect(result.current.selectedIds).toEqual(['2', '3']);
  });

  test('focusActivityを呼ぶと、指定したインデックスがfocusedIndexになる', () => {
    const { result } = renderHook(() => useActivitySelection());
    act(() => {
      result.current.selectActivities(['1', '2']);
    });

    act(() => {
      result.current.focusActivity(1);
    });

    expect(result.current.focusedIndex).toBe(1);
  });

  test('clearFocusを呼ぶと、選択は保持したままフォーカスのみ解除される', () => {
    const { result } = renderHook(() => useActivitySelection());
    act(() => {
      result.current.selectActivities(['1', '2']);
      result.current.focusActivity(0);
    });

    act(() => {
      result.current.clearFocus();
    });

    expect(result.current.focusedIndex).toBeNull();
    expect(result.current.selectedIds).toEqual(['1', '2']);
  });

  test('clearSelectionを呼ぶと、選択・フォーカスともに解除される', () => {
    const { result } = renderHook(() => useActivitySelection());
    act(() => {
      result.current.selectActivities(['1', '2']);
      result.current.focusActivity(0);
    });

    act(() => {
      result.current.clearSelection();
    });

    expect(result.current.selectedIds).toEqual([]);
    expect(result.current.focusedIndex).toBeNull();
  });
});
