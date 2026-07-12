import { useCallback, useState } from 'react';

/** useActivitySelectionの戻り値 */
type UseActivitySelectionResult = {
  /** 選択中のアクティビティID一覧（直近のクリックで検出された順） */
  selectedIds: string[];
  /** フォーカス中のアクティビティを指す、selectedIds内のインデックス。未フォーカスの場合はnull */
  focusedIndex: number | null;
  /** 地図クリックで検出したID一覧で、既存の選択を置き換える */
  selectActivities: (ids: string[]) => void;
  /** 指定したインデックスのアクティビティにフォーカスする */
  focusActivity: (index: number) => void;
  /** フォーカスを解除し、選択一覧の表示に戻す */
  clearFocus: () => void;
  /** 選択・フォーカスを両方解除する */
  clearSelection: () => void;
};

/**
 * 地図上でクリックされたアクティビティの選択状態・フォーカス状態を管理するフック。
 * 選択中に別の箇所をクリックすると、既存の選択は置き換わる（累積しない）
 * @returns 選択・フォーカス状態と操作関数
 */
export const useActivitySelection = (): UseActivitySelectionResult => {
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

  return { selectedIds, focusedIndex, selectActivities, focusActivity, clearFocus, clearSelection };
};
