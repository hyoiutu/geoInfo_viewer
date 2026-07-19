import { act, renderHook } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import type { CyclingActivity } from '../../api/activitiesApi';
import { DEFAULT_ACTIVITY_FILTER } from '../../types/activityFilter';
import { useActivitySelection } from '../useActivitySelection';

const createActivity = (overrides: Partial<CyclingActivity>): CyclingActivity => ({
  id: '1',
  name: 'テストライド',
  distanceMeters: 20000,
  movingTimeSeconds: 3600,
  elapsedTimeSeconds: 3900,
  elevationGainMeters: 50,
  startDate: '2026-06-15T01:00:00.000Z',
  path: null,
  ...overrides
});

describe('useActivitySelectionに関するテスト', () => {
  test('初期状態では選択・フォーカスともに無い', () => {
    const { result } = renderHook(() => useActivitySelection([], DEFAULT_ACTIVITY_FILTER));

    expect(result.current.selectedActivities).toEqual([]);
    expect(result.current.focusedActivity).toBeNull();
  });

  test('selectActivitiesを呼ぶと、指定したIDに対応するアクティビティが選択される', () => {
    const activities = [createActivity({ id: '1' }), createActivity({ id: '2' })];
    const { result } = renderHook(() => useActivitySelection(activities, DEFAULT_ACTIVITY_FILTER));

    act(() => {
      result.current.selectActivities(['1', '2']);
    });

    expect(result.current.selectedActivities).toEqual(activities);
  });

  test('selectActivitiesを複数回呼ぶと、既存の選択が新しいID一覧で置き換わる（累積しない）', () => {
    const activities = [createActivity({ id: '1' }), createActivity({ id: '2' }), createActivity({ id: '3' })];
    const { result } = renderHook(() => useActivitySelection(activities, DEFAULT_ACTIVITY_FILTER));
    act(() => {
      result.current.selectActivities(['1']);
    });

    act(() => {
      result.current.selectActivities(['2', '3']);
    });

    expect(result.current.selectedActivities).toEqual([activities[1], activities[2]]);
  });

  test('focusActivityを呼ぶと、指定したインデックスに対応するアクティビティがfocusedActivityになる', () => {
    const activities = [createActivity({ id: '1' }), createActivity({ id: '2' })];
    const { result } = renderHook(() => useActivitySelection(activities, DEFAULT_ACTIVITY_FILTER));
    act(() => {
      result.current.selectActivities(['1', '2']);
    });

    act(() => {
      result.current.focusActivity(1);
    });

    expect(result.current.focusedActivity).toEqual(activities[1]);
  });

  test('clearFocusを呼ぶと、選択は保持したままフォーカスのみ解除される', () => {
    const activities = [createActivity({ id: '1' }), createActivity({ id: '2' })];
    const { result } = renderHook(() => useActivitySelection(activities, DEFAULT_ACTIVITY_FILTER));
    act(() => {
      result.current.selectActivities(['1', '2']);
      result.current.focusActivity(0);
    });

    act(() => {
      result.current.clearFocus();
    });

    expect(result.current.focusedActivity).toBeNull();
    expect(result.current.selectedActivities).toEqual(activities);
  });

  test('clearSelectionを呼ぶと、選択・フォーカスともに解除される', () => {
    const activities = [createActivity({ id: '1' }), createActivity({ id: '2' })];
    const { result } = renderHook(() => useActivitySelection(activities, DEFAULT_ACTIVITY_FILTER));
    act(() => {
      result.current.selectActivities(['1', '2']);
      result.current.focusActivity(0);
    });

    act(() => {
      result.current.clearSelection();
    });

    expect(result.current.selectedActivities).toEqual([]);
    expect(result.current.focusedActivity).toBeNull();
  });

  describe('フィルタによる自動除外に関するテスト', () => {
    test('選択中のアクティビティが全てフィルタ条件を満たす場合、選択・フォーカスともに変化しない', () => {
      const activities = [
        createActivity({ id: '1', elevationGainMeters: 100 }),
        createActivity({ id: '2', elevationGainMeters: 200 })
      ];
      const filter = { ...DEFAULT_ACTIVITY_FILTER, minElevationGainMeters: 50 };
      const { result, rerender } = renderHook(({ activities, filter }) => useActivitySelection(activities, filter), {
        initialProps: { activities, filter }
      });
      act(() => {
        result.current.selectActivities(['1', '2']);
        result.current.focusActivity(1);
      });

      rerender({ activities, filter });

      expect(result.current.selectedActivities).toEqual(activities);
      expect(result.current.focusedActivity).toEqual(activities[1]);
    });

    test('選択中のアクティビティのうちフィルタ条件を満たさなくなったものを選択から取り除く', () => {
      const activities = [
        createActivity({ id: '1', elevationGainMeters: 100 }),
        createActivity({ id: '2', elevationGainMeters: 30 }),
        createActivity({ id: '3', elevationGainMeters: 100 })
      ];
      const { result, rerender } = renderHook(({ activities, filter }) => useActivitySelection(activities, filter), {
        initialProps: { activities, filter: DEFAULT_ACTIVITY_FILTER }
      });
      act(() => {
        result.current.selectActivities(['1', '2', '3']);
      });

      rerender({ activities, filter: { ...DEFAULT_ACTIVITY_FILTER, minElevationGainMeters: 50 } });

      expect(result.current.selectedActivities).toEqual([activities[0], activities[2]]);
    });

    test('フォーカス中のアクティビティがフィルタ条件を満たさなくなった場合、フォーカスを解除する', () => {
      const activities = [
        createActivity({ id: '1', elevationGainMeters: 100 }),
        createActivity({ id: '2', elevationGainMeters: 30 })
      ];
      const { result, rerender } = renderHook(({ activities, filter }) => useActivitySelection(activities, filter), {
        initialProps: { activities, filter: DEFAULT_ACTIVITY_FILTER }
      });
      act(() => {
        result.current.selectActivities(['1', '2']);
        result.current.focusActivity(1);
      });

      rerender({ activities, filter: { ...DEFAULT_ACTIVITY_FILTER, minElevationGainMeters: 50 } });

      expect(result.current.selectedActivities).toEqual([activities[0]]);
      expect(result.current.focusedActivity).toBeNull();
    });

    test('フォーカス中のアクティビティがフィルタ条件を満たし続ける場合、選択が縮んでもフォーカスは同じアクティビティを指し続ける', () => {
      const activities = [
        createActivity({ id: '1', elevationGainMeters: 30 }),
        createActivity({ id: '2', elevationGainMeters: 100 }),
        createActivity({ id: '3', elevationGainMeters: 100 })
      ];
      const { result, rerender } = renderHook(({ activities, filter }) => useActivitySelection(activities, filter), {
        initialProps: { activities, filter: DEFAULT_ACTIVITY_FILTER }
      });
      act(() => {
        result.current.selectActivities(['1', '2', '3']);
        result.current.focusActivity(2);
      });

      rerender({ activities, filter: { ...DEFAULT_ACTIVITY_FILTER, minElevationGainMeters: 50 } });

      expect(result.current.selectedActivities).toEqual([activities[1], activities[2]]);
      expect(result.current.focusedActivity).toEqual(activities[2]);
    });
  });
});
