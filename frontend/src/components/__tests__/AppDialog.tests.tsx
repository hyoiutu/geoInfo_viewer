import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { renderWithChakra } from '../../test-utils/renderWithChakra';
import { AppDialog } from '../AppDialog';

describe('AppDialogに関するテスト', () => {
  test('isOpenがfalseの場合、ダイアログは表示されない', () => {
    renderWithChakra(
      <AppDialog isOpen={false} onClose={vi.fn()} title="タイトル">
        本文
      </AppDialog>
    );

    expect(screen.queryByText('タイトル')).not.toBeInTheDocument();
  });

  test('isOpenがtrueの場合、タイトル・本文が表示される', () => {
    renderWithChakra(
      <AppDialog isOpen onClose={vi.fn()} title="タイトル">
        本文の内容
      </AppDialog>
    );

    expect(screen.getByText('タイトル')).toBeInTheDocument();
    expect(screen.getByText('本文の内容')).toBeInTheDocument();
  });

  test('閉じる(×)ボタンを押すと、onCloseが呼ばれる', () => {
    const onClose = vi.fn();
    renderWithChakra(
      <AppDialog isOpen onClose={onClose} title="タイトル">
        本文
      </AppDialog>
    );

    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('showCloseButtonがfalseの場合、閉じる(×)ボタンは表示されない', () => {
    renderWithChakra(
      <AppDialog isOpen onClose={vi.fn()} title="タイトル" showCloseButton={false}>
        本文
      </AppDialog>
    );

    expect(screen.queryByRole('button', { name: '閉じる' })).not.toBeInTheDocument();
  });

  test('footerを渡した場合、フッター内容が表示される', () => {
    renderWithChakra(
      <AppDialog isOpen onClose={vi.fn()} title="タイトル" footer={<button type="button">実行</button>}>
        本文
      </AppDialog>
    );

    expect(screen.getByRole('button', { name: '実行' })).toBeInTheDocument();
  });

  test('footerを渡さない場合、フッターは表示されない', () => {
    renderWithChakra(
      <AppDialog isOpen onClose={vi.fn()} title="タイトル">
        本文
      </AppDialog>
    );

    expect(screen.queryByRole('button', { name: '実行' })).not.toBeInTheDocument();
  });
});
