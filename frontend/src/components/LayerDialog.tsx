import { Button, Checkbox, Flex, NativeSelect } from '@chakra-ui/react';
import { useAtomValue } from 'jotai';
import type { ChangeEvent } from 'react';
import { useState } from 'react';
import { isApplyingLayerSettingsAtom } from '../atoms/isApplyingLayerSettingsAtom';
import { layerVisibilityAtom, municipalityEraAtom } from '../atoms/layerSettingsAtom';
import { createDefaultVisibility, LAYER_DEFINITIONS } from '../constants/layerDefinitions';
import { MUNICIPALITY_ERA_OPTIONS } from '../constants/municipalityEraOptions';
import type { LayerVisibility, ToggleableLayerId } from '../types/layer';
import { isMunicipalityEra, MUNICIPALITY_ERA_CURRENT, type MunicipalityEra } from '../types/municipalityEra';
import { AppDialog } from './AppDialog';

/** AdminBoundaryEraSelectのprops */
type AdminBoundaryEraSelectProps = {
  /** 入力中(draft)の行政区画の年代 */
  era: MunicipalityEra;
  /** 年代が変更されたときに呼ばれるコールバック */
  onChange: (era: MunicipalityEra) => void;
  /** trueの間はプルダウンを無効化する（Issue #65 PR#110レビュー対応、下記disabled参照） */
  disabled: boolean;
};

/** 行政区画レイヤーの表示年代を選ぶプルダウン */
const AdminBoundaryEraSelect = ({ era, onChange, disabled }: AdminBoundaryEraSelectProps) => {
  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    if (isMunicipalityEra(event.target.value)) {
      onChange(event.target.value);
    }
  };

  return (
    <NativeSelect.Root size="sm" width="auto" marginLeft="6" disabled={disabled}>
      <NativeSelect.Field aria-label="行政区画の年代" value={era} onChange={handleChange}>
        {MUNICIPALITY_ERA_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </NativeSelect.Field>
      <NativeSelect.Indicator />
    </NativeSelect.Root>
  );
};

/** LayerDialogのprops */
type LayerDialogProps = {
  /** ダイアログが開いているかどうか */
  isOpen: boolean;
  /** 実行ボタンが押されたときに、入力中の表示状態・年代を渡して呼ばれるコールバック */
  onApply: (visibility: LayerVisibility, era: MunicipalityEra) => void;
  /**
   * 実行後の非同期処理（行政区画データ取得・自転車ログ同期）が完了した瞬間
   * （isApplyingLayerSettingsAtomがtrue→falseに変化したタイミング）に呼ばれるコールバック（省略可）。
   * 呼び出し元はこれを使ってダイアログを閉じる（Issue #127）
   */
  onApplyCompleted?: () => void;
  /** ダイアログを閉じる（閉じるボタン押下・背景クリック等）ときに呼ばれるコールバック */
  onClose: () => void;
};

/**
 * レイヤーの表示/非表示を切り替えるダイアログ。行政区画レイヤーには、表示する年代を選ぶプルダウンを併設する。
 * 入力中(draft)の表示状態・年代はこのコンポーネント内部で保持し、「実行」を押したときのみonApplyで確定値を通知する。
 * 閉じるボタン等で閉じた場合、入力中の内容は破棄される（Issue #53）。直前の実行に伴う非同期処理（行政区画データ取得・
 * 自転車ログ同期）が完了しておらず待機中かどうかは`isApplyingLayerSettingsAtom`（グローバルステート）から取得する。
 * trueの間は実行ボタン・リセットボタン・チェックボックス・年代選択プルダウンを無効化するのに加え、`AppDialog`の
 * `closeDisabled`propへ渡すことで閉じる(×)ボタン・Escapeキー・背景クリックによるクローズも全て無効化する。
 * 実行ボタンの無効化は、待機中の多重実行によってpendingLayerApplyが上書きされ未完了の非同期処理の追跡が失われる
 * 不具合を防ぐ（Issue #65 PR#110レビュー対応）。他の入力・クローズ手段の無効化は、待機完了時にダイアログが
 * 自動的に閉じ入力中(draft)の内容が破棄される際、待機中に加えた変更・操作がユーザーの意図しないまま失われることを
 * 防ぐ（PR #110再レビュー対応）。現在適用中のレイヤー表示状態・行政区画の年代はlayerSettingsAtom
 * （グローバルステート）から直接参照し、props経由のバケツリレーは行わない（Issue #125）。実行後の
 * 非同期処理完了（isApplyingLayerSettingsAtomのtrue→false遷移）はonApplyCompletedで呼び出し元へ
 * 通知する。検知はuseEffectを使わず、AppDialogのonOpenと同じ「レンダー中に前回値と比較してsetStateする」
 * パターンで行う（Issue #127）
 */
export const LayerDialog = ({ isOpen, onApply, onApplyCompleted, onClose }: LayerDialogProps) => {
  const isApplyingLayerSettings = useAtomValue(isApplyingLayerSettingsAtom);
  const appliedVisibility = useAtomValue(layerVisibilityAtom);
  const appliedEra = useAtomValue(municipalityEraAtom);
  const [draftVisibility, setDraftVisibility] = useState(appliedVisibility);
  const [draftEra, setDraftEra] = useState(appliedEra);

  // isApplyingLayerSettingsがtrue→falseに変化した瞬間にonApplyCompletedを呼ぶ。AppDialogのonOpenと
  // 同じ「propの変化に応じてレンダー中にstateを調整する」パターンを使い、useEffectを使わずに検知する
  // （Issue #127）
  const [prevIsApplyingLayerSettings, setPrevIsApplyingLayerSettings] = useState(isApplyingLayerSettings);
  if (isApplyingLayerSettings !== prevIsApplyingLayerSettings) {
    setPrevIsApplyingLayerSettings(isApplyingLayerSettings);
    if (!isApplyingLayerSettings) {
      onApplyCompleted?.();
    }
  }

  // ダイアログを開くたびに、入力中の内容を現在適用中の内容へリセットする。AppDialogのonOpen経由で
  // isOpenがfalse→trueに変化した瞬間にのみ呼ばれる（useEffectは使わない、Issue #125）
  const handleOpen = () => {
    setDraftVisibility(appliedVisibility);
    setDraftEra(appliedEra);
  };

  const toggleDraft = (id: ToggleableLayerId) => {
    setDraftVisibility((current) => ({ ...current, [id]: !current[id] }));
  };

  const handleReset = () => {
    setDraftVisibility(createDefaultVisibility());
    setDraftEra(MUNICIPALITY_ERA_CURRENT);
  };

  const handleApply = () => {
    onApply(draftVisibility, draftEra);
  };

  return (
    <AppDialog
      isOpen={isOpen}
      onOpen={handleOpen}
      onClose={onClose}
      closeDisabled={isApplyingLayerSettings}
      title="レイヤー切り替え"
      footer={
        <>
          <Button onClick={handleReset} variant="ghost" size="sm" disabled={isApplyingLayerSettings}>
            リセット
          </Button>
          <Button onClick={handleApply} size="sm" disabled={isApplyingLayerSettings}>
            実行
          </Button>
        </>
      }
    >
      <Flex direction="column" gap="3">
        {LAYER_DEFINITIONS.map((layerDefinition) => (
          <Flex key={layerDefinition.id} direction="column" gap="2">
            <Checkbox.Root
              checked={draftVisibility[layerDefinition.id]}
              disabled={isApplyingLayerSettings}
              onCheckedChange={() => toggleDraft(layerDefinition.id)}
            >
              <Checkbox.HiddenInput />
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              <Checkbox.Label>{layerDefinition.name}</Checkbox.Label>
            </Checkbox.Root>
            {layerDefinition.id === 'admin-boundary' && (
              <AdminBoundaryEraSelect era={draftEra} onChange={setDraftEra} disabled={isApplyingLayerSettings} />
            )}
          </Flex>
        ))}
      </Flex>
    </AppDialog>
  );
};
