import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { renderWithChakra } from '../../test-utils/renderWithChakra';
import { DEFAULT_ACTIVITY_FILTER } from '../../types/activityFilter';
import { FilterDialog } from '../FilterDialog';

const renderDialog = (overrides: Partial<Parameters<typeof FilterDialog>[0]> = {}) =>
  renderWithChakra(
    <FilterDialog isOpen appliedFilter={DEFAULT_ACTIVITY_FILTER} onApply={vi.fn()} onClose={vi.fn()} {...overrides} />
  );

describe('FilterDialogに関するテスト', () => {
  test('isOpenがfalseの場合、ダイアログは表示されない', () => {
    renderDialog({ isOpen: false });

    expect(screen.queryByText('自転車ログのフィルタ')).not.toBeInTheDocument();
  });

  test('isOpenがtrueの場合、ダイアログのタイトルが表示される', () => {
    renderDialog();

    expect(screen.getByText('自転車ログのフィルタ')).toBeInTheDocument();
  });

  test('検索範囲始まりの年を選択すると、入力欄に反映される', () => {
    renderDialog();

    fireEvent.change(screen.getByLabelText('検索範囲始まりの年'), { target: { value: '2026' } });

    expect(screen.getByLabelText('検索範囲始まりの年')).toHaveValue('2026');
  });

  test('実行ボタンを押すと、onApplyが入力中のフィルタ条件で呼ばれる', () => {
    const onApply = vi.fn();
    renderDialog({ onApply });

    fireEvent.change(screen.getByLabelText('獲得標高'), { target: { value: '500' } });
    fireEvent.click(screen.getByRole('button', { name: '実行' }));

    expect(onApply).toHaveBeenCalledWith({ ...DEFAULT_ACTIVITY_FILTER, minElevationGainMeters: 500 });
  });

  test('平均時速を入力し実行すると、onApplyがminAverageSpeedKmhを含めて呼ばれる', () => {
    const onApply = vi.fn();
    renderDialog({ onApply });

    fireEvent.change(screen.getByLabelText('平均時速'), { target: { value: '25.5' } });
    fireEvent.click(screen.getByRole('button', { name: '実行' }));

    expect(onApply).toHaveBeenCalledWith({ ...DEFAULT_ACTIVITY_FILTER, minAverageSpeedKmh: 25.5 });
  });

  test('走行距離を入力し実行すると、onApplyがminDistanceKmを含めて呼ばれる', () => {
    const onApply = vi.fn();
    renderDialog({ onApply });

    fireEvent.change(screen.getByLabelText('走行距離'), { target: { value: '30.5' } });
    fireEvent.click(screen.getByRole('button', { name: '実行' }));

    expect(onApply).toHaveBeenCalledWith({ ...DEFAULT_ACTIVITY_FILTER, minDistanceKm: 30.5 });
  });

  test('リセットボタンを押すと、入力中の内容が全てデフォルト(未入力)に戻る', () => {
    renderDialog();
    fireEvent.change(screen.getByLabelText('獲得標高'), { target: { value: '500' } });

    fireEvent.click(screen.getByRole('button', { name: 'リセット' }));

    expect(screen.getByLabelText('獲得標高')).toHaveValue(null);
  });

  test('月のみ入力され年が未入力の場合、実行ボタンが無効化され検証メッセージが表示される', () => {
    renderDialog();

    fireEvent.change(screen.getByLabelText('検索範囲始まりの月'), { target: { value: '3' } });

    expect(screen.getByRole('button', { name: '実行' })).toBeDisabled();
    expect(
      screen.getByText('年月を範囲指定する場合、年も入力してください（月のみの指定はできません）')
    ).toBeInTheDocument();
  });

  test('閉じるボタンを押すと、onCloseが呼ばれる（入力中の変更は破棄される）', () => {
    const onClose = vi.fn();
    renderDialog({ onClose });

    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('入力中の内容を変更したまま閉じて再度開くと、appliedFilterの内容に復元される', () => {
    const { rerender } = renderDialog();
    fireEvent.change(screen.getByLabelText('獲得標高'), { target: { value: '500' } });
    expect(screen.getByLabelText('獲得標高')).toHaveValue(500);

    rerender(
      <FilterDialog isOpen={false} appliedFilter={DEFAULT_ACTIVITY_FILTER} onApply={vi.fn()} onClose={vi.fn()} />
    );
    rerender(<FilterDialog isOpen appliedFilter={DEFAULT_ACTIVITY_FILTER} onApply={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByLabelText('獲得標高')).toHaveValue(null);
  });
});
