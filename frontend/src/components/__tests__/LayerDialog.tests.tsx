import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { LAYER_DEFINITIONS } from '../../constants/layerDefinitions';
import { renderWithChakra } from '../../test-utils/renderWithChakra';
import type { LayerVisibility } from '../../types/layer';
import { MUNICIPALITY_ERA_CURRENT } from '../../types/municipalityEra';
import { LayerDialog } from '../LayerDialog';

const DEFAULT_VISIBILITY: LayerVisibility = {
  'osm-poi': true,
  'osm-road': true,
  'osm-building': true,
  'osm-place-name': true,
  'admin-boundary': true,
  'aerial-photo': false,
  'bicycle-log': false
};

const renderDialog = (overrides: Partial<Parameters<typeof LayerDialog>[0]> = {}) =>
  renderWithChakra(
    <LayerDialog
      isOpen
      appliedVisibility={DEFAULT_VISIBILITY}
      appliedEra={MUNICIPALITY_ERA_CURRENT}
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

  test('isOpenがtrueの場合、appliedVisibilityの内容が各レイヤーのチェック状態に反映される', () => {
    renderDialog();

    for (const layerDefinition of LAYER_DEFINITIONS) {
      const checkbox = screen.getByRole('checkbox', { name: layerDefinition.name });
      if (DEFAULT_VISIBILITY[layerDefinition.id]) {
        expect(checkbox).toBeChecked();
      } else {
        expect(checkbox).not.toBeChecked();
      }
    }
  });

  test('チェックボックスをクリックすると、そのレイヤーのチェック状態が切り替わる', async () => {
    renderDialog();

    fireEvent.click(screen.getByRole('checkbox', { name: '航空写真' }));

    // Chakra UIのCheckbox.RootのonCheckedChangeはマイクロタスク経由で非同期に発火する
    await waitFor(() => expect(screen.getByRole('checkbox', { name: '航空写真' })).toBeChecked());
  });

  test('リセットボタンを押すと、入力中の内容がデフォルト値(各レイヤーのdefaultChecked)に戻る', async () => {
    renderDialog();
    fireEvent.click(screen.getByRole('checkbox', { name: '航空写真' }));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: '航空写真' })).toBeChecked());

    fireEvent.click(screen.getByRole('button', { name: 'リセット' }));

    await waitFor(() => expect(screen.getByRole('checkbox', { name: '航空写真' })).not.toBeChecked());
  });

  test('実行ボタンを押すと、onApplyが入力中の表示状態・年代で呼ばれる', async () => {
    const onApply = vi.fn();
    renderDialog({ onApply });
    fireEvent.click(screen.getByRole('checkbox', { name: '航空写真' }));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: '航空写真' })).toBeChecked());

    fireEvent.click(screen.getByRole('button', { name: '実行' }));

    expect(onApply).toHaveBeenCalledWith({ ...DEFAULT_VISIBILITY, 'aerial-photo': true }, MUNICIPALITY_ERA_CURRENT);
  });

  test('閉じるボタンを押すと、onCloseが呼ばれる（入力中の変更は破棄される）', () => {
    const onClose = vi.fn();
    renderDialog({ onClose });

    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('入力中の内容を変更したまま閉じて再度開くと、appliedVisibilityの内容に復元される', async () => {
    const { rerender } = renderDialog();
    fireEvent.click(screen.getByRole('checkbox', { name: '航空写真' }));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: '航空写真' })).toBeChecked());

    rerender(
      <LayerDialog
        isOpen={false}
        appliedVisibility={DEFAULT_VISIBILITY}
        appliedEra={MUNICIPALITY_ERA_CURRENT}
        onApply={vi.fn()}
        onClose={vi.fn()}
      />
    );
    rerender(
      <LayerDialog
        isOpen
        appliedVisibility={DEFAULT_VISIBILITY}
        appliedEra={MUNICIPALITY_ERA_CURRENT}
        onApply={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole('checkbox', { name: '航空写真' })).not.toBeChecked();
  });

  describe('行政区画の年代選択に関するテスト', () => {
    test('appliedEraの内容が年代選択プルダウンに反映される', () => {
      renderDialog({ appliedEra: '2000-10-01' });

      expect(screen.getByRole('combobox', { name: '行政区画の年代' })).toHaveValue('2000-10-01');
    });

    test('年代を変更し実行ボタンを押すと、onApplyが変更後の年代で呼ばれる', () => {
      const onApply = vi.fn();
      renderDialog({ onApply });

      fireEvent.change(screen.getByRole('combobox', { name: '行政区画の年代' }), {
        target: { value: '2000-10-01' }
      });
      fireEvent.click(screen.getByRole('button', { name: '実行' }));

      expect(onApply).toHaveBeenCalledWith(DEFAULT_VISIBILITY, '2000-10-01');
    });
  });
});
