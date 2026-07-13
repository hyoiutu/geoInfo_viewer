import { Button, Dialog, Portal, Text } from '@chakra-ui/react';
import { useAtom } from 'jotai';
import { useState } from 'react';
import { errorsAtom } from '../atoms/errorsAtom';
import type { AppErrorInfo } from '../types/apiError';

const FIRST_INDEX = 0;
const SINGLE_ERROR_COUNT = 1;

/**
 * APIエラー(AppErrorInfo)をユーザーへ提示する共通ダイアログ。グローバルなエラースタック（errorsAtom）を直接参照する。
 * 複数のエラーが同時に発生した場合はスタックし、1つのダイアログ内で前へ/次へで切り替えて閲覧できる。
 */
export const ErrorDialog = () => {
  const [errors, setErrors] = useAtom(errorsAtom);
  const [viewIndex, setViewIndex] = useState(FIRST_INDEX);
  const lastIndex = Math.max(errors.length - SINGLE_ERROR_COUNT, FIRST_INDEX);
  // errorsが外部から縮む（dismiss等）とviewIndexが範囲外になりうるため、表示直前に範囲内へ丸める
  const currentIndex = Math.min(viewIndex, lastIndex);
  const currentError: AppErrorInfo | undefined = errors[currentIndex];

  const dismiss = (index: number) => {
    setErrors((current) => current.filter((_, currentErrorIndex) => currentErrorIndex !== index));
  };

  const handleOpenChange = (details: { open: boolean }) => {
    if (!details.open && currentError) {
      dismiss(currentIndex);
    }
  };

  const handleDismiss = () => {
    if (currentError) {
      dismiss(currentIndex);
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
