import { useCallback, useState } from 'react';
import { LAYER_DEFINITIONS } from '../constants/layerDefinitions';
import type { LayerVisibility, ToggleableLayerId } from '../types/layer';

/** @returns LAYER_DEFINITIONSのdefaultCheckedを反映したデフォルトの表示状態 */
const createDefaultVisibility = (): LayerVisibility =>
  Object.fromEntries(
    LAYER_DEFINITIONS.map((layerDefinition) => [layerDefinition.id, layerDefinition.defaultChecked])
  ) as LayerVisibility;

/** useLayerVisibilityの戻り値 */
type UseLayerVisibilityResult = {
  /** 現在適用中の表示/非表示状態（地図に反映される） */
  appliedVisibility: LayerVisibility;
  /** ダイアログ内の入力中（未確定）の表示/非表示状態 */
  draftVisibility: LayerVisibility;
  /** ダイアログが開いているかどうか */
  isDialogOpen: boolean;
  /** ダイアログを開く。入力状態は現在適用中の内容にリセットされる */
  openDialog: () => void;
  /** ダイアログを閉じる（入力中の内容は破棄され、適用中の表示状態は変化しない） */
  closeDialog: () => void;
  /** 指定したレイヤーの入力中の表示/非表示状態を反転させる */
  toggleDraft: (id: ToggleableLayerId) => void;
  /** 入力中の表示状態を全てデフォルトに戻す */
  resetDraft: () => void;
  /** 入力中の表示状態を適用し、ダイアログを閉じる */
  applyDraft: () => void;
};

/**
 * レイヤー切り替えダイアログの開閉・入力中の内容・適用中の表示/非表示状態を管理するフック。
 * ダイアログを開くたびに入力欄は現在適用中の内容へリセットされ、「実行」を押したときのみ適用状態へ反映される
 * @returns レイヤー表示状態と操作関数
 */
export const useLayerVisibility = (): UseLayerVisibilityResult => {
  const [appliedVisibility, setAppliedVisibility] = useState<LayerVisibility>(createDefaultVisibility);
  const [draftVisibility, setDraftVisibility] = useState<LayerVisibility>(createDefaultVisibility);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const openDialog = useCallback(() => {
    setDraftVisibility(appliedVisibility);
    setIsDialogOpen(true);
  }, [appliedVisibility]);

  const closeDialog = useCallback(() => {
    setIsDialogOpen(false);
  }, []);

  const toggleDraft = useCallback((id: ToggleableLayerId) => {
    setDraftVisibility((current) => ({ ...current, [id]: !current[id] }));
  }, []);

  const resetDraft = useCallback(() => {
    setDraftVisibility(createDefaultVisibility());
  }, []);

  const applyDraft = useCallback(() => {
    setAppliedVisibility(draftVisibility);
    setIsDialogOpen(false);
  }, [draftVisibility]);

  return {
    appliedVisibility,
    draftVisibility,
    isDialogOpen,
    openDialog,
    closeDialog,
    toggleDraft,
    resetDraft,
    applyDraft
  };
};
