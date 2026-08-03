import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { renderWithChakra } from '../../test-utils/renderWithChakra';
import { AppDialog } from '../AppDialog';

// Chakra UI（内部の@zag-js/dismissable）はEscapeキー・背景クリックの検知リスナーを
// requestAnimationFrame経由で遅延登録するため、「呼ばれないこと」を確認する際はこの遅延を
// またいで複数回発火し続ける必要がある。「閉じること」を確認する側のwaitFor（デフォルトタイムアウト1000ms）と
// 同程度の猶予を持たせ、システム負荷が高い環境でも登録前にリトライを使い切らないようにする（PR #110レビュー対応）
const DISMISS_RETRY_INTERVAL_MS = 50;
const DISMISS_RETRY_COUNT = 20;
const waitForNextTick = () => new Promise((resolve) => setTimeout(resolve, DISMISS_RETRY_INTERVAL_MS));

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

  test('closeDisabledがtrueの場合、閉じる(×)ボタンが無効化される（PR #110レビュー対応）', () => {
    renderWithChakra(
      <AppDialog isOpen onClose={vi.fn()} title="タイトル" closeDisabled>
        本文
      </AppDialog>
    );

    expect(screen.getByRole('button', { name: '閉じる' })).toBeDisabled();
  });

  test('closeDisabledを渡さない場合、閉じる(×)ボタンは無効化されない', () => {
    renderWithChakra(
      <AppDialog isOpen onClose={vi.fn()} title="タイトル">
        本文
      </AppDialog>
    );

    expect(screen.getByRole('button', { name: '閉じる' })).not.toBeDisabled();
  });

  test('closeDisabledがtrueの場合、Dialog.CloseTrigger（×ボタンと同じ位置に重なる無名のクローズ要素）も無効化される（PR #110レビュー対応）', () => {
    renderWithChakra(
      <AppDialog isOpen onClose={vi.fn()} title="タイトル" closeDisabled>
        本文
      </AppDialog>
    );

    expect(screen.getByTestId('app-dialog-close-trigger')).toBeDisabled();
  });

  test('closeDisabledがfalseの場合、Escapeキーを押すとonCloseが呼ばれる（PR #110レビュー対応）', async () => {
    // Chakra UI（内部の@zag-js/dismissable）はEscapeキー検知リスナーをrequestAnimationFrame経由で
    // 遅延登録するため、登録完了前に発火したイベントは検知されない。登録完了後に発火が成功するまで
    // 繰り返しEscapeキーを送り続ける（waitFor内でfireEventを呼ぶことでリトライごとに再発火する）
    const onClose = vi.fn();
    renderWithChakra(
      <AppDialog isOpen onClose={onClose} title="タイトル">
        本文
      </AppDialog>
    );

    await waitFor(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).toHaveBeenCalled();
    });
  });

  test('closeDisabledがtrueの場合、Escapeキーを押し続けてもonCloseが呼ばれない（PR #110レビュー対応）', async () => {
    const onClose = vi.fn();
    renderWithChakra(
      <AppDialog isOpen onClose={onClose} title="タイトル" closeDisabled>
        本文
      </AppDialog>
    );

    // リスナー登録の遅延をまたいで複数回発火しても呼ばれないことを確認する
    for (let i = 0; i < DISMISS_RETRY_COUNT; i++) {
      fireEvent.keyDown(document, { key: 'Escape' });
      await waitForNextTick();
    }

    expect(onClose).not.toHaveBeenCalled();
  });

  test('closeDisabledがfalseの場合、背景(バックドロップ)をクリックするとonCloseが呼ばれる（PR #110レビュー対応）', async () => {
    const onClose = vi.fn();
    renderWithChakra(
      <AppDialog isOpen onClose={onClose} title="タイトル">
        本文
      </AppDialog>
    );
    const backdrop = screen.getByTestId('app-dialog-backdrop');

    await waitFor(() => {
      fireEvent.pointerDown(backdrop);
      expect(onClose).toHaveBeenCalled();
    });
  });

  test('closeDisabledがtrueの場合、背景(バックドロップ)をクリックし続けてもonCloseが呼ばれない（PR #110レビュー対応）', async () => {
    const onClose = vi.fn();
    renderWithChakra(
      <AppDialog isOpen onClose={onClose} title="タイトル" closeDisabled>
        本文
      </AppDialog>
    );
    const backdrop = screen.getByTestId('app-dialog-backdrop');

    for (let i = 0; i < DISMISS_RETRY_COUNT; i++) {
      fireEvent.pointerDown(backdrop);
      await waitForNextTick();
    }

    expect(onClose).not.toHaveBeenCalled();
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
