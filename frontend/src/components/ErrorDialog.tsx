import { Button, Dialog, Portal, Text } from '@chakra-ui/react';
import { useState } from 'react';
import type { AppErrorInfo } from '../types/apiError';

/** ErrorDialogのprops */
type ErrorDialogProps = {
  /** 表示するエラーのスタック（発生順）。空配列の場合はダイアログを表示しない */
  errors: AppErrorInfo[];
  /** 表示中のエラーが閉じられたとき、そのインデックスを引数に呼ばれるコールバック */
  onDismiss: (index: number) => void;
};

const FIRST_INDEX = 0;
const SINGLE_ERROR_COUNT = 1;

/**
 * APIエラー(AppErrorInfo)をユーザーへ提示する共通ダイアログ。
 * 複数のエラーが同時に発生した場合はスタックし、1つのダイアログ内で前へ/次へで切り替えて閲覧できる。
 */
export const ErrorDialog = ({ errors, onDismiss }: ErrorDialogProps) => {
  const [viewIndex, setViewIndex] = useState(FIRST_INDEX);
  const lastIndex = Math.max(errors.length - SINGLE_ERROR_COUNT, FIRST_INDEX);
  // errorsが外部から縮む（dismiss等）とviewIndexが範囲外になりうるため、表示直前に範囲内へ丸める
  const currentIndex = Math.min(viewIndex, lastIndex);
  const currentError: AppErrorInfo | undefined = errors[currentIndex];

  const handleOpenChange = (details: { open: boolean }) => {
    if (!details.open && currentError) {
      onDismiss(currentIndex);
    }
  };

  const handleDismiss = () => {
    if (currentError) {
      onDismiss(currentIndex);
    }
  };

  const handlePrevious = () => setViewIndex((current) => Math.max(current - 1, FIRST_INDEX));
  const handleNext = () => setViewIndex((current) => Math.min(current + 1, lastIndex));

  return (
    <Dialog.Root open={currentError !== undefined} onOpenChange={handleOpenChange} role="alertdialog">
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>
                エラーが発生しました
                {errors.length > SINGLE_ERROR_COUNT && `（${currentIndex + 1}/${errors.length}）`}
              </Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Text>{currentError?.message}</Text>
              {currentError?.hint !== null && currentError?.hint !== undefined && (
                <Text fontSize="sm" color="fg.muted" marginTop="2">
                  {currentError.hint}
                </Text>
              )}
            </Dialog.Body>
            <Dialog.Footer>
              {errors.length > SINGLE_ERROR_COUNT && (
                <>
                  <Button onClick={handlePrevious} disabled={currentIndex === FIRST_INDEX} variant="ghost" size="sm">
                    前へ
                  </Button>
                  <Button onClick={handleNext} disabled={currentIndex === lastIndex} variant="ghost" size="sm">
                    次へ
                  </Button>
                </>
              )}
              <Button onClick={handleDismiss}>OK</Button>
            </Dialog.Footer>
            <Dialog.CloseTrigger />
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
