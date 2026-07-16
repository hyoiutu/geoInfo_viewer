import { Button, Checkbox, Flex, NativeSelect } from '@chakra-ui/react';
import { MUNICIPALITY_ERA_OPTIONS } from '../constants/municipalityEraOptions';
import type { ToggleableLayerId } from '../types/layer';
import { isMunicipalityEra, type MunicipalityEra } from '../types/municipalityEra';
import { AppDialog } from './AppDialog';

/** ダイアログに表示する1レイヤー分の情報 */
type LayerDialogLayer = {
  /** レイヤーID */
  id: ToggleableLayerId;
  /** 表示名 */
  name: string;
  /** 入力中(draft)の表示/非表示状態 */
  checked: boolean;
};

/** LayerDialogのprops */
type LayerDialogProps = {
  /** ダイアログが開いているかどうか */
  isOpen: boolean;
  /** ダイアログに表示するレイヤー一覧（入力中の表示/非表示状態を含む） */
  layers: LayerDialogLayer[];
  /** 入力中(draft)の行政区画の年代 */
  era: MunicipalityEra;
  /** 行政区画の年代が変更されたときに呼ばれるコールバック */
  onEraChange: (era: MunicipalityEra) => void;
  /** 入力中のレイヤーの表示/非表示状態が切り替えられたときに呼ばれるコールバック */
  onToggleDraft: (id: ToggleableLayerId) => void;
  /** リセットボタンが押されたときに呼ばれるコールバック */
  onReset: () => void;
  /** 実行ボタンが押されたときに呼ばれるコールバック */
  onApply: () => void;
  /** ダイアログを閉じる（閉じるボタン押下・背景クリック等）ときに呼ばれるコールバック */
  onClose: () => void;
};

/**
 * レイヤーの表示/非表示を切り替えるダイアログ。行政区画レイヤーには、表示する年代を選ぶプルダウンを併設する。
 * 入力内容は「実行」を押したときのみ確定し、閉じるボタン等で閉じた場合は破棄される
 */
export const LayerDialog = ({
  isOpen,
  layers,
  era,
  onEraChange,
  onToggleDraft,
  onReset,
  onApply,
  onClose
}: LayerDialogProps) => (
  <AppDialog
    isOpen={isOpen}
    onClose={onClose}
    title="レイヤー切り替え"
    footer={
      <>
        <Button onClick={onReset} variant="ghost" size="sm">
          リセット
        </Button>
        <Button onClick={onApply} size="sm">
          実行
        </Button>
      </>
    }
  >
    <Flex direction="column" gap="3">
      {layers.map((layer) => (
        <Flex key={layer.id} direction="column" gap="2">
          <Checkbox.Root checked={layer.checked} onCheckedChange={() => onToggleDraft(layer.id)}>
            <Checkbox.HiddenInput />
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            <Checkbox.Label>{layer.name}</Checkbox.Label>
          </Checkbox.Root>
          {layer.id === 'admin-boundary' && (
            <NativeSelect.Root size="sm" width="auto" marginLeft="6">
              <NativeSelect.Field
                aria-label="行政区画の年代"
                value={era}
                onChange={(event) => {
                  if (isMunicipalityEra(event.target.value)) {
                    onEraChange(event.target.value);
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
          )}
        </Flex>
      ))}
    </Flex>
  </AppDialog>
);
