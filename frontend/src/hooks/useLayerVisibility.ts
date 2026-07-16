import { useCallback, useState } from 'react';
import { LAYER_DEFINITIONS } from '../constants/layerDefinitions';
import type { LayerVisibility, ToggleableLayerId } from '../types/layer';
import { MUNICIPALITY_ERA_CURRENT, type MunicipalityEra } from '../types/municipalityEra';
import { typedFromEntries } from '../utils/typedObject';

/** @returns LAYER_DEFINITIONSのdefaultCheckedを反映したデフォルトの表示状態 */
const createDefaultVisibility = (): LayerVisibility =>
  typedFromEntries(LAYER_DEFINITIONS.map((layerDefinition) => [layerDefinition.id, layerDefinition.defaultChecked]));

/** useLayerVisibilityの戻り値 */
type UseLayerVisibilityResult = {
  /** 現在適用中の表示/非表示状態（地図に反映される） */
  appliedVisibility: LayerVisibility;
  /** ダイアログ内の入力中（未確定）の表示/非表示状態 */
  draftVisibility: LayerVisibility;
  /** 現在適用中の行政区画の年代（地図・通過自治体判定に反映される） */
  appliedEra: MunicipalityEra;
  /** ダイアログ内の入力中（未確定）の行政区画の年代 */
  draftEra: MunicipalityEra;
  /** 入力中の行政区画の年代を変更する */
  setDraftEra: (era: MunicipalityEra) => void;
  /** ダイアログが開いているかどうか */
  isDialogOpen: boolean;
  /** ダイアログを開く。入力状態は現在適用中の内容にリセットされる */
  openDialog: () => void;
  /** ダイアログを閉じる（入力中の内容は破棄され、適用中の表示状態は変化しない） */
  closeDialog: () => void;
  /** 指定したレイヤーの入力中の表示/非表示状態を反転させる */
  toggleDraft: (id: ToggleableLayerId) => void;
  /** 入力中の表示状態・行政区画の年代を全てデフォルトに戻す */
  resetDraft: () => void;
  /** 入力中の表示状態・行政区画の年代を適用し、ダイアログを閉じる */
  applyDraft: () => void;
};

/**
 * レイヤー切り替えダイアログの開閉・入力中の内容・適用中の表示/非表示状態・行政区画の年代を管理するフック。
 * 行政区画の年代選択は表示/非表示状態と同じダイアログ内で編集され、同じ「実行」タイミングで確定するため
 * この1つのフックにまとめている。
 * ダイアログを開くたびに入力欄は現在適用中の内容へリセットされ、「実行」を押したときのみ適用状態へ反映される
 * @returns レイヤー表示状態・行政区画の年代と操作関数
 */
export const useLayerVisibility = (): UseLayerVisibilityResult => {
  const [appliedVisibility, setAppliedVisibility] = useState<LayerVisibility>(createDefaultVisibility);
  const [draftVisibility, setDraftVisibility] = useState<LayerVisibility>(createDefaultVisibility);
  const [appliedEra, setAppliedEra] = useState<MunicipalityEra>(MUNICIPALITY_ERA_CURRENT);
  const [draftEra, setDraftEra] = useState<MunicipalityEra>(MUNICIPALITY_ERA_CURRENT);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const openDialog = useCallback(() => {
    setDraftVisibility(appliedVisibility);
    setDraftEra(appliedEra);
    setIsDialogOpen(true);
  }, [appliedVisibility, appliedEra]);

  const closeDialog = useCallback(() => {
    setIsDialogOpen(false);
  }, []);

  const toggleDraft = useCallback((id: ToggleableLayerId) => {
    setDraftVisibility((current) => ({ ...current, [id]: !current[id] }));
  }, []);

  const resetDraft = useCallback(() => {
    setDraftVisibility(createDefaultVisibility());
    setDraftEra(MUNICIPALITY_ERA_CURRENT);
  }, []);

  const applyDraft = useCallback(() => {
    setAppliedVisibility(draftVisibility);
    setAppliedEra(draftEra);
    setIsDialogOpen(false);
  }, [draftVisibility, draftEra]);

  return {
    appliedVisibility,
    draftVisibility,
    appliedEra,
    draftEra,
    setDraftEra,
    isDialogOpen,
    openDialog,
    closeDialog,
    toggleDraft,
    resetDraft,
    applyDraft
  };
};
