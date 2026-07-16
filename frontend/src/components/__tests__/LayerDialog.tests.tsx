import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { renderWithChakra } from '../../test-utils/renderWithChakra';
import { LayerDialog } from '../LayerDialog';

const LAYERS = [
  { id: 'osm-poi' as const, name: 'POI', checked: true },
  { id: 'osm-road' as const, name: '道路', checked: true },
  { id: 'aerial-photo' as const, name: '航空写真', checked: false }
];

const LAYERS_WITH_ADMIN_BOUNDARY = [...LAYERS, { id: 'admin-boundary' as const, name: '行政区画', checked: true }];

const renderDialog = (overrides: Partial<Parameters<typeof LayerDialog>[0]> = {}) =>
  renderWithChakra(
    <LayerDialog
      isOpen
      layers={LAYERS}
      era="current"
      onEraChange={vi.fn()}
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

  describe('行政区画の年代選択に関するテスト', () => {
    test('行政区画のレイヤーが無い場合、年代選択プルダウンは表示されない', () => {
      renderDialog({ layers: LAYERS });

      expect(screen.queryByRole('combobox', { name: '行政区画の年代' })).not.toBeInTheDocument();
    });

    test('行政区画のレイヤーがある場合、年代選択プルダウンが選択中の年代で表示される', () => {
      renderDialog({ layers: LAYERS_WITH_ADMIN_BOUNDARY, era: '2000-10-01' });

      expect(screen.getByRole('combobox', { name: '行政区画の年代' })).toHaveValue('2000-10-01');
    });

    test('年代を変更すると、onEraChangeが選択した年代で呼ばれる', () => {
      const onEraChange = vi.fn();
      renderDialog({ layers: LAYERS_WITH_ADMIN_BOUNDARY, onEraChange });

      fireEvent.change(screen.getByRole('combobox', { name: '行政区画の年代' }), {
        target: { value: '2000-10-01' }
      });

      expect(onEraChange).toHaveBeenCalledWith('2000-10-01');
    });
  });
});
