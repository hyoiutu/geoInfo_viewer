import { Button, Checkbox, Flex, NativeSelect } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
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
};

/** 行政区画レイヤーの表示年代を選ぶプルダウン */
const AdminBoundaryEraSelect = ({ era, onChange }: AdminBoundaryEraSelectProps) => (
  <NativeSelect.Root size="sm" width="auto" marginLeft="6">
    <NativeSelect.Field
      aria-label="行政区画の年代"
      value={era}
      onChange={(event) => {
        if (isMunicipalityEra(event.target.value)) {
          onChange(event.target.value);
        }
      }}
    >
      {MUNICIPALITY_ERA_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </NativeSelect.Field>
    <NativeSelect.Indicator />
  </NativeSelect.Root>
);

/** LayerDialogのprops */
type LayerDialogProps = {
  /** ダイアログが開いているかどうか */
  isOpen: boolean;
  /** 現在適用中(地図に反映済み)のレイヤー表示/非表示状態。ダイアログを開くたびに入力中の内容の初期値として使う */
  appliedVisibility: LayerVisibility;
  /** 現在適用中(地図に反映済み)の行政区画の年代。ダイアログを開くたびに入力中の内容の初期値として使う */
  appliedEra: MunicipalityEra;
  /** 実行ボタンが押されたときに、入力中の表示状態・年代を渡して呼ばれるコールバック */
  onApply: (visibility: LayerVisibility, era: MunicipalityEra) => void;
  /** ダイアログを閉じる（閉じるボタン押下・背景クリック等）ときに呼ばれるコールバック */
  onClose: () => void;
};

/**
 * レイヤーの表示/非表示を切り替えるダイアログ。行政区画レイヤーには、表示する年代を選ぶプルダウンを併設する。
 * 入力中(draft)の表示状態・年代はこのコンポーネント内部で保持し、「実行」を押したときのみonApplyで確定値を通知する。
 * 閉じるボタン等で閉じた場合、入力中の内容は破棄される（Issue #53）
 */
export const LayerDialog = ({ isOpen, appliedVisibility, appliedEra, onApply, onClose }: LayerDialogProps) => {
  const [draftVisibility, setDraftVisibility] = useState(appliedVisibility);
  const [draftEra, setDraftEra] = useState(appliedEra);

  // ダイアログを開くたびに、入力中の内容を現在適用中の内容へリセットする
  useEffect(() => {
    if (isOpen) {
      setDraftVisibility(appliedVisibility);
      setDraftEra(appliedEra);
    }
  }, [isOpen, appliedVisibility, appliedEra]);

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
      onClose={onClose}
      title="レイヤー切り替え"
      footer={
        <>
          <Button onClick={handleReset} variant="ghost" size="sm">
            リセット
          </Button>
          <Button onClick={handleApply} size="sm">
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
              onCheckedChange={() => toggleDraft(layerDefinition.id)}
            >
              <Checkbox.HiddenInput />
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              <Checkbox.Label>{layerDefinition.name}</Checkbox.Label>
            </Checkbox.Root>
            {layerDefinition.id === 'admin-boundary' && (
              <AdminBoundaryEraSelect era={draftEra} onChange={setDraftEra} />
            )}
          </Flex>
        ))}
      </Flex>
    </AppDialog>
  );
};
