import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { renderWithChakra } from '../../test-utils/renderWithChakra';
import { LayerDialog } from '../LayerDialog';

const LAYERS = [
  { id: 'osm-poi' as const, name: 'POI', checked: true },
  { id: 'osm-road' as const, name: '道路', checked: true },
  { id: 'aerial-photo' as const, name: '航空写真', checked: false }
];

const renderDialog = (overrides: Partial<Parameters<typeof LayerDialog>[0]> = {}) =>
  renderWithChakra(
    <LayerDialog
      isOpen
      layers={LAYERS}
      onToggleDraft={vi.fn()}
      onReset={vi.fn()}
      onApply={vi.fn()}
      onClose={vi.fn()}
      {...overrides}
    />
  );

describe('LayerDialogに関するテスト', () => {
  test('isOpenがfalseの場合、ダイアログは表示されない', () => {
    renderDialog({ isOpen: false });

    expect(screen.queryByText('レイヤー切り替え')).not.toBeInTheDocument();
  });

  test('isOpenがtrueの場合、ダイアログのタイトルと各レイヤーのチェックボックスが表示される', () => {
    renderDialog();

    expect(screen.getByText('レイヤー切り替え')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'POI' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: '道路' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: '航空写真' })).not.toBeChecked();
  });

  test('チェックボックスをクリックすると、onToggleDraftが対象のレイヤーIDで呼ばれる', async () => {
    const onToggleDraft = vi.fn();
    renderDialog({ onToggleDraft });

    fireEvent.click(screen.getByRole('checkbox', { name: '航空写真' }));

    // Chakra UIのCheckbox.RootのonCheckedChangeはマイクロタスク経由で非同期に発火する
    await waitFor(() => expect(onToggleDraft).toHaveBeenCalledWith('aerial-photo'));
  });

  test('リセットボタンを押すと、onResetが呼ばれる', () => {
    const onReset = vi.fn();
    renderDialog({ onReset });

    fireEvent.click(screen.getByRole('button', { name: 'リセット' }));

    expect(onReset).toHaveBeenCalledTimes(1);
  });

  test('実行ボタンを押すと、onApplyが呼ばれる', () => {
    const onApply = vi.fn();
    renderDialog({ onApply });

    fireEvent.click(screen.getByRole('button', { name: '実行' }));

    expect(onApply).toHaveBeenCalledTimes(1);
  });

  test('閉じるボタンを押すと、onCloseが呼ばれる', () => {
    const onClose = vi.fn();
    renderDialog({ onClose });

    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
