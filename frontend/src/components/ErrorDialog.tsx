import { Button, Dialog, Portal, Text } from '@chakra-ui/react';
import type { AppErrorInfo } from '../types/apiError';

type ErrorDialogProps = {
  error: AppErrorInfo | null;
  onClose: () => void;
};

// APIエラー(AppErrorInfo)をユーザーへ提示する共通ダイアログ。種別(errorCode相当のmessage)と対処法(hint)を表示する。
export const ErrorDialog = ({ error, onClose }: ErrorDialogProps) => {
  const handleOpenChange = (details: { open: boolean }) => {
    if (!details.open) {
      onClose();
    }
  };

  return (
    <Dialog.Root open={error !== null} onOpenChange={handleOpenChange} role="alertdialog">
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>エラーが発生しました</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Text>{error?.message}</Text>
              {error?.hint !== null && error?.hint !== undefined && (
                <Text fontSize="sm" color="fg.muted" marginTop="2">
                  {error.hint}
                </Text>
              )}
            </Dialog.Body>
            <Dialog.Footer>
              <Button onClick={onClose}>OK</Button>
            </Dialog.Footer>
            <Dialog.CloseTrigger />
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
