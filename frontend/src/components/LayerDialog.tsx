import { Button, Checkbox, Dialog, Flex, Portal } from '@chakra-ui/react';
import type { ToggleableLayerId } from '../types/layer';

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
 * レイヤーの表示/非表示を切り替えるダイアログ。
 * 入力内容は「実行」を押したときのみ確定し、閉じるボタン等で閉じた場合は破棄される
 */
export const LayerDialog = ({ isOpen, layers, onToggleDraft, onReset, onApply, onClose }: LayerDialogProps) => {
  const handleOpenChange = (details: { open: boolean }) => {
    if (!details.open) {
      onClose();
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={handleOpenChange}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>レイヤー切り替え</Dialog.Title>
              <Button
                onClick={onClose}
                aria-label="閉じる"
                variant="ghost"
                size="sm"
                position="absolute"
                top="2"
                right="2"
              >
                ×
              </Button>
            </Dialog.Header>
            <Dialog.Body>
              <Flex direction="column" gap="3">
                {layers.map((layer) => (
                  <Checkbox.Root key={layer.id} checked={layer.checked} onCheckedChange={() => onToggleDraft(layer.id)}>
                    <Checkbox.HiddenInput />
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    <Checkbox.Label>{layer.name}</Checkbox.Label>
                  </Checkbox.Root>
                ))}
              </Flex>
            </Dialog.Body>
            <Dialog.Footer>
              <Button onClick={onReset} variant="ghost" size="sm">
                リセット
              </Button>
              <Button onClick={onApply} size="sm">
                実行
              </Button>
            </Dialog.Footer>
            <Dialog.CloseTrigger />
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
