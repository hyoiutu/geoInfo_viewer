import { useCallback, useState } from 'react';

/** useActivitySelectionの戻り値 */
type UseActivitySelectionResult = {
  /** 選択中のアクティビティID一覧（クリックした順、重複を含みうる） */
  selectedIds: string[];
  /** フォーカス中のアクティビティを指す、selectedIds内のインデックス。未フォーカスの場合はnull */
  focusedIndex: number | null;
  /** 地図クリックで検出したID一覧を、既存の選択に追加する */
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
 * 選択は「クリックした順の配列」で保持し、重複するIDの選択も許容する
 * @returns 選択・フォーカス状態と操作関数
 */
export const useActivitySelection = (): UseActivitySelectionResult => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  const selectActivities = useCallback((ids: string[]) => {
    setSelectedIds((current) => [...current, ...ids]);
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
