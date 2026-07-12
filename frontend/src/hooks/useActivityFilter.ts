import { useCallback, useState } from 'react';
import { type ActivityFilter, DEFAULT_ACTIVITY_FILTER } from '../types/activityFilter';

/** useActivityFilterの戻り値 */
type UseActivityFilterResult = {
  /** 現在適用中のフィルタ条件（地図の表示絞り込みに使う） */
  appliedFilter: ActivityFilter;
  /** ダイアログ内の入力中（未確定）のフィルタ条件 */
  draftFilter: ActivityFilter;
  /** ダイアログが開いているかどうか */
  isDialogOpen: boolean;
  /** ダイアログを開く。入力欄は現在適用中の内容にリセットされる */
  openDialog: () => void;
  /** ダイアログを閉じる（入力中の内容は破棄され、適用中のフィルタ条件は変化しない） */
  closeDialog: () => void;
  /** 入力中のフィルタ条件の一部を更新する */
  updateDraft: (partial: Partial<ActivityFilter>) => void;
  /** 入力中のフィルタ条件を全てデフォルト（未入力）に戻す */
  resetDraft: () => void;
  /** 入力中のフィルタ条件を適用し、ダイアログを閉じる */
  applyDraft: () => void;
};

/**
 * 自転車ログのフィルタダイアログの開閉・入力中の内容・適用中のフィルタ条件を管理するフック。
 * ダイアログを開くたびに入力欄は現在適用中の内容へリセットされ、「実行」を押したときのみ適用状態へ反映される
 * @returns フィルタの状態と操作関数
 */
export const useActivityFilter = (): UseActivityFilterResult => {
  const [appliedFilter, setAppliedFilter] = useState<ActivityFilter>(DEFAULT_ACTIVITY_FILTER);
  const [draftFilter, setDraftFilter] = useState<ActivityFilter>(DEFAULT_ACTIVITY_FILTER);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const openDialog = useCallback(() => {
    setDraftFilter(appliedFilter);
    setIsDialogOpen(true);
  }, [appliedFilter]);

  const closeDialog = useCallback(() => {
    setIsDialogOpen(false);
  }, []);

  const updateDraft = useCallback((partial: Partial<ActivityFilter>) => {
    setDraftFilter((current) => ({ ...current, ...partial }));
  }, []);

  const resetDraft = useCallback(() => {
    setDraftFilter(DEFAULT_ACTIVITY_FILTER);
  }, []);

  const applyDraft = useCallback(() => {
    setAppliedFilter(draftFilter);
    setIsDialogOpen(false);
  }, [draftFilter]);

  return { appliedFilter, draftFilter, isDialogOpen, openDialog, closeDialog, updateDraft, resetDraft, applyDraft };
};
