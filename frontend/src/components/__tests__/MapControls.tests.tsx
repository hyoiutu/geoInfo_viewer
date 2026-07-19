import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { renderWithChakra } from '../../test-utils/renderWithChakra';
import { MapControls } from '../MapControls';

describe('MapControlsに関するテスト', () => {
  test('レイヤー・フィルタ・統計・設定の4つのアイコンボタンが表示される', () => {
    renderWithChakra(
      <MapControls
        onOpenLayerDialog={vi.fn()}
        onOpenFilterDialog={vi.fn()}
        onOpenStatisticsDialog={vi.fn()}
        onOpenSettingsDialog={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'レイヤー切り替え' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '自転車ログ フィルタ' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '統計データ' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '設定' })).toBeInTheDocument();
  });

  test('統計アイコンを押すと、onOpenStatisticsDialogが呼ばれる', () => {
    const onOpenStatisticsDialog = vi.fn();
    renderWithChakra(
      <MapControls
        onOpenLayerDialog={vi.fn()}
        onOpenFilterDialog={vi.fn()}
        onOpenStatisticsDialog={onOpenStatisticsDialog}
        onOpenSettingsDialog={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '統計データ' }));

    expect(onOpenStatisticsDialog).toHaveBeenCalledTimes(1);
  });

  test('レイヤーアイコンを押すと、onOpenLayerDialogが呼ばれる', () => {
    const onOpenLayerDialog = vi.fn();
    renderWithChakra(
      <MapControls
        onOpenLayerDialog={onOpenLayerDialog}
        onOpenFilterDialog={vi.fn()}
        onOpenStatisticsDialog={vi.fn()}
        onOpenSettingsDialog={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'レイヤー切り替え' }));

    expect(onOpenLayerDialog).toHaveBeenCalledTimes(1);
  });

  test('フィルタアイコンを押すと、onOpenFilterDialogが呼ばれる', () => {
    const onOpenFilterDialog = vi.fn();
    renderWithChakra(
      <MapControls
        onOpenLayerDialog={vi.fn()}
        onOpenFilterDialog={onOpenFilterDialog}
        onOpenStatisticsDialog={vi.fn()}
        onOpenSettingsDialog={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '自転車ログ フィルタ' }));

    expect(onOpenFilterDialog).toHaveBeenCalledTimes(1);
  });

  test('設定アイコンを押すと、onOpenSettingsDialogが呼ばれる', () => {
    const onOpenSettingsDialog = vi.fn();
    renderWithChakra(
      <MapControls
        onOpenLayerDialog={vi.fn()}
        onOpenFilterDialog={vi.fn()}
        onOpenStatisticsDialog={vi.fn()}
        onOpenSettingsDialog={onOpenSettingsDialog}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '設定' }));

    expect(onOpenSettingsDialog).toHaveBeenCalledTimes(1);
  });
});
