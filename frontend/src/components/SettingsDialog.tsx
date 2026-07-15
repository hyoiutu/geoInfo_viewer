import { Button, Dialog, Flex, Portal } from '@chakra-ui/react';

/** SettingsDialogのprops */
type SettingsDialogProps = {
  /** ダイアログが開いているかどうか */
  isOpen: boolean;
  /** 初期取り込み・強制再取得のボタンが押せない状態かどうか（いずれかが実行中の場合true） */
  isBackfillRunning: boolean;
  /** 初期取り込みボタンが押されたときに呼ばれるコールバック */
  onStartBackfill: () => void;
  /** 強制再取得ボタンが押されたときに呼ばれるコールバック */
  onStartForceRefetch: () => void;
  /** ダイアログを閉じるときに呼ばれるコールバック */
  onClose: () => void;
};

/**
 * 自転車ログの初期取り込み・強制再取得を開始する設定ダイアログ。
 * いずれかのボタンを押すとその機能を実行しダイアログを閉じる
 */
export const SettingsDialog = ({
  isOpen,
  isBackfillRunning,
  onStartBackfill,
  onStartForceRefetch,
  onClose
}: SettingsDialogProps) => {
  const handleOpenChange = (details: { open: boolean }) => {
    if (!details.open) {
      onClose();
    }
  };

  const handleStartBackfill = () => {
    onStartBackfill();
    onClose();
  };

  const handleStartForceRefetch = () => {
    onStartForceRefetch();
    onClose();
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={handleOpenChange}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>設定</Dialog.Title>
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
              <Flex direction="column" gap="2">
                <Button onClick={handleStartBackfill} disabled={isBackfillRunning} size="sm" width="100%">
                  自転車ログ初期取り込み
                </Button>
                <Button onClick={handleStartForceRefetch} disabled={isBackfillRunning} size="sm" width="100%">
                  自転車ログ強制再取得
                </Button>
              </Flex>
            </Dialog.Body>
            <Dialog.CloseTrigger />
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
