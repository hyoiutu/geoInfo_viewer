import { Button, Dialog, Portal } from '@chakra-ui/react';
import type { ReactNode } from 'react';

const CLOSE_BUTTON_LABEL = '閉じる';

/** AppDialogのprops */
type AppDialogProps = {
  /** ダイアログの開閉状態 */
  isOpen: boolean;
  /** ダイアログを閉じる際に呼ばれるコールバック（背景クリック・Escapeキー・閉じる(×)ボタン共通） */
  onClose: () => void;
  /** ヘッダーに表示するタイトル */
  title: ReactNode;
  /** ヘッダー右上の閉じる(×)ボタンを表示するか（省略時はtrue。独自の閉じる手段のみ提供する場合はfalseにする） */
  showCloseButton?: boolean;
  /** Dialog.Rootのrole（省略時は'dialog'） */
  role?: 'dialog' | 'alertdialog';
  /** フッターに表示する内容（省略時はDialog.Footer自体を表示しない） */
  footer?: ReactNode;
  /** ボディに表示する内容 */
  children: ReactNode;
};

/**
 * 全てのダイアログで共通するChakra UIのDialog構造（Root/Backdrop/Positioner/Content/Header/Body/Footer）
 * をまとめたラッパー。個々のダイアログはこのコンポーネントに委譲することで、共通のラッパー構造による
 * JSXネストの深さを各ダイアログ側では1階層に集約できる
 */
export const AppDialog = ({
  isOpen,
  onClose,
  title,
  showCloseButton = true,
  role = 'dialog',
  footer,
  children
}: AppDialogProps) => {
  const handleOpenChange = (details: { open: boolean }) => {
    if (!details.open) {
      onClose();
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={handleOpenChange} role={role}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>{title}</Dialog.Title>
              {showCloseButton && (
                <Button
                  onClick={onClose}
                  aria-label={CLOSE_BUTTON_LABEL}
                  variant="ghost"
                  size="sm"
                  position="absolute"
                  top="2"
                  right="2"
                >
                  ×
                </Button>
              )}
            </Dialog.Header>
            <Dialog.Body>{children}</Dialog.Body>
            {footer && <Dialog.Footer>{footer}</Dialog.Footer>}
            <Dialog.CloseTrigger />
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
