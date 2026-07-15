import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { renderWithChakra } from '../../test-utils/renderWithChakra';
import { SettingsDialog } from '../SettingsDialog';

const renderDialog = (overrides: Partial<Parameters<typeof SettingsDialog>[0]> = {}) =>
  renderWithChakra(
    <SettingsDialog
      isOpen={true}
      isBackfillRunning={false}
      onStartBackfill={vi.fn()}
      onStartForceRefetch={vi.fn()}
      onClose={vi.fn()}
      {...overrides}
    />
  );

describe('SettingsDialogに関するテスト', () => {
  test('isOpenがfalseの場合、ダイアログは表示されない', () => {
    renderDialog({ isOpen: false });

    expect(screen.queryByText('設定')).not.toBeInTheDocument();
  });

  test('isOpenがtrueの場合、ダイアログのタイトルと各ボタンが表示される', () => {
    renderDialog();

    expect(screen.getByText('設定')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '自転車ログ初期取り込み' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '自転車ログ強制再取得' })).toBeInTheDocument();
  });

  test('初期取り込みボタンを押すと、onStartBackfillが呼ばれダイアログが閉じる', () => {
    const onStartBackfill = vi.fn();
    const onClose = vi.fn();
    renderDialog({ onStartBackfill, onClose });

    fireEvent.click(screen.getByRole('button', { name: '自転車ログ初期取り込み' }));

    expect(onStartBackfill).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('強制再取得ボタンを押すと、onStartForceRefetchが呼ばれダイアログが閉じる', () => {
    const onStartForceRefetch = vi.fn();
    const onClose = vi.fn();
    renderDialog({ onStartForceRefetch, onClose });

    fireEvent.click(screen.getByRole('button', { name: '自転車ログ強制再取得' }));

    expect(onStartForceRefetch).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('isBackfillRunningがtrueの場合、両方のボタンがdisabledになる', () => {
    renderDialog({ isBackfillRunning: true });

    expect(screen.getByRole('button', { name: '自転車ログ初期取り込み' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '自転車ログ強制再取得' })).toBeDisabled();
  });

  test('閉じるボタンを押すと、onCloseが呼ばれる', () => {
    const onClose = vi.fn();
    renderDialog({ onClose });

    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
