import { act, renderHook } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { useLayerVisibility } from '../useLayerVisibility';

const DEFAULT_VISIBILITY = {
  'osm-poi': true,
  'osm-road': true,
  'osm-building': true,
  'osm-place-name': true,
  'admin-boundary': true,
  'aerial-photo': false,
  'bicycle-log': false
};

describe('useLayerVisibilityに関するテスト', () => {
  test('初期状態では、適用中・入力中ともにデフォルトの表示状態で、ダイアログは閉じている', () => {
    const { result } = renderHook(() => useLayerVisibility());

    expect(result.current.appliedVisibility).toEqual(DEFAULT_VISIBILITY);
    expect(result.current.draftVisibility).toEqual(DEFAULT_VISIBILITY);
    expect(result.current.isDialogOpen).toBe(false);
  });

  test('openDialogを呼ぶと、ダイアログが開く', () => {
    const { result } = renderHook(() => useLayerVisibility());

    act(() => {
      result.current.openDialog();
    });

    expect(result.current.isDialogOpen).toBe(true);
  });

  test('openDialogを呼ぶと、入力中の表示状態が現在適用中の内容にリセットされる', () => {
    const { result } = renderHook(() => useLayerVisibility());
    act(() => {
      result.current.toggleDraft('aerial-photo');
    });
    act(() => {
      result.current.applyDraft();
    });
    act(() => {
      result.current.toggleDraft('osm-road');
    });
    act(() => {
      result.current.closeDialog();
    });

    act(() => {
      result.current.openDialog();
    });

    expect(result.current.draftVisibility).toEqual({ ...DEFAULT_VISIBILITY, 'aerial-photo': true });
  });

  test('closeDialogを呼ぶと、入力中の内容を破棄してダイアログが閉じ、適用中の表示状態は変化しない', () => {
    const { result } = renderHook(() => useLayerVisibility());
    act(() => {
      result.current.openDialog();
      result.current.toggleDraft('osm-road');
    });

    act(() => {
      result.current.closeDialog();
    });

    expect(result.current.isDialogOpen).toBe(false);
    expect(result.current.appliedVisibility).toEqual(DEFAULT_VISIBILITY);
  });

  test('toggleDraftを呼ぶと、指定したレイヤーのみ入力中の表示状態が反転する', () => {
    const { result } = renderHook(() => useLayerVisibility());

    act(() => {
      result.current.toggleDraft('osm-road');
    });

    expect(result.current.draftVisibility).toEqual({ ...DEFAULT_VISIBILITY, 'osm-road': false });
  });

  test('resetDraftを呼ぶと、入力中の表示状態がデフォルト値に戻る（適用中の表示状態は変化しない）', () => {
    const { result } = renderHook(() => useLayerVisibility());
    act(() => {
      result.current.toggleDraft('aerial-photo');
    });
    act(() => {
      result.current.applyDraft();
    });
    act(() => {
      result.current.openDialog();
      result.current.toggleDraft('osm-road');
    });

    act(() => {
      result.current.resetDraft();
    });

    expect(result.current.draftVisibility).toEqual(DEFAULT_VISIBILITY);
    expect(result.current.appliedVisibility).toEqual({ ...DEFAULT_VISIBILITY, 'aerial-photo': true });
  });

  test('applyDraftを呼ぶと、入力中の表示状態が適用中の表示状態へ反映され、ダイアログが閉じる', () => {
    const { result } = renderHook(() => useLayerVisibility());
    act(() => {
      result.current.openDialog();
      result.current.toggleDraft('bicycle-log');
    });

    act(() => {
      result.current.applyDraft();
    });

    expect(result.current.appliedVisibility).toEqual({ ...DEFAULT_VISIBILITY, 'bicycle-log': true });
    expect(result.current.isDialogOpen).toBe(false);
  });
});
