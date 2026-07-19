import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CyclingActivity } from '../api/activitiesApi';
import type { ActivityFilter } from '../types/activityFilter';
import { filterActivities } from '../utils/filterActivities';

/** useActivitySelectionの戻り値 */
type UseActivitySelectionResult = {
  /** 選択中のアクティビティ一覧（直近のクリックで検出された順） */
  selectedActivities: CyclingActivity[];
  /** フォーカス中のアクティビティ。未フォーカスの場合はnull */
  focusedActivity: CyclingActivity | null;
  /** 地図クリックで検出したID一覧で、既存の選択を置き換える */
  selectActivities: (ids: string[]) => void;
  /** 指定したインデックス（selectedActivities内の位置）のアクティビティにフォーカスする */
  focusActivity: (index: number) => void;
  /** フォーカスを解除し、選択一覧の表示に戻す */
  clearFocus: () => void;
  /** 選択・フォーカスを両方解除する */
  clearSelection: () => void;
};

/**
 * 地図上でクリックされたアクティビティの選択状態・フォーカス状態を管理するフック。
 * 選択中に別の箇所をクリックすると、既存の選択は置き換わる（累積しない）。
 * フィルタ条件（`filter`）で表示対象外になったアクティビティは、選択・フォーカスから自動的に取り除かれる。
 * ID→アクティビティの変換をこのフック内で完結させることで、呼び出し元（MapWorkspace）・受け取り側
 * （MapView・ActivityDetailSidebar）がそれぞれ個別にID解決を行う重複を無くしている（Issue #53、PR #69レビュー対応）
 * @param activities 選択対象となりうる全アクティビティ一覧
 * @param filter 現在適用中のフィルタ条件
 * @returns 選択・フォーカス状態と操作関数
 */
export const useActivitySelection = (
  activities: CyclingActivity[],
  filter: ActivityFilter
): UseActivitySelectionResult => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  const selectActivities = useCallback((ids: string[]) => {
    setSelectedIds(ids);
  }, []);

  const focusActivity = useCallback((index: number) => {
    setFocusedIndex(index);
  }, []);

  const clearFocus = useCallback(() => {
    setFocusedIndex(null);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
    setFocusedIndex(null);
  }, []);

  const visibleIds = useMemo(
    () => new Set(filterActivities(activities, filter).map((activity) => activity.id)),
    [activities, filter]
  );

  // フィルタで除外され地図上に表示されなくなったアクティビティは、選択・フォーカス状態からも取り除く
  useEffect(() => {
    const focusedId = focusedIndex === null ? null : (selectedIds[focusedIndex] ?? null);
    const nextSelectedIds = selectedIds.filter((id) => visibleIds.has(id));
    if (nextSelectedIds.length === selectedIds.length) {
      return;
    }
    setSelectedIds(nextSelectedIds);
    setFocusedIndex(focusedId !== null && visibleIds.has(focusedId) ? nextSelectedIds.indexOf(focusedId) : null);
  }, [visibleIds, selectedIds, focusedIndex]);

  const selectedActivities = useMemo(
    () =>
      selectedIds
        .map((id) => activities.find((activity) => activity.id === id))
        .filter((activity): activity is CyclingActivity => activity !== undefined),
    [selectedIds, activities]
  );
  const focusedActivity = focusedIndex === null ? null : (selectedActivities[focusedIndex] ?? null);

  return {
    selectedActivities,
    focusedActivity,
    selectActivities,
    focusActivity,
    clearFocus,
    clearSelection
  };
};
