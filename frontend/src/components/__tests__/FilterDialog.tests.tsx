import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { renderWithChakra } from '../../test-utils/renderWithChakra';
import { DEFAULT_ACTIVITY_FILTER } from '../../types/activityFilter';
import { FilterDialog } from '../FilterDialog';

const renderDialog = (overrides: Partial<Parameters<typeof FilterDialog>[0]> = {}) =>
  renderWithChakra(
    <FilterDialog
      isOpen
      draftFilter={DEFAULT_ACTIVITY_FILTER}
      onUpdateDraft={vi.fn()}
      onReset={vi.fn()}
      onApply={vi.fn()}
      onClose={vi.fn()}
      {...overrides}
    />
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

  test('検索範囲始まりの年を選択すると、onUpdateDraftがstartYearで呼ばれる', () => {
    const onUpdateDraft = vi.fn();
    renderDialog({ onUpdateDraft });

    fireEvent.change(screen.getByLabelText('検索範囲始まりの年'), { target: { value: '2026' } });

    expect(onUpdateDraft).toHaveBeenCalledWith({ startYear: 2026 });
  });

  test('検索範囲始まりの年を未選択に戻すと、onUpdateDraftがnullで呼ばれる', () => {
    const onUpdateDraft = vi.fn();
    renderDialog({ onUpdateDraft, draftFilter: { ...DEFAULT_ACTIVITY_FILTER, startYear: 2026 } });

    fireEvent.change(screen.getByLabelText('検索範囲始まりの年'), { target: { value: '' } });

    expect(onUpdateDraft).toHaveBeenCalledWith({ startYear: null });
  });

  test('検索範囲終わりの月を選択すると、onUpdateDraftがendMonthで呼ばれる', () => {
    const onUpdateDraft = vi.fn();
    renderDialog({ onUpdateDraft });

    fireEvent.change(screen.getByLabelText('検索範囲終わりの月'), { target: { value: '12' } });

    expect(onUpdateDraft).toHaveBeenCalledWith({ endMonth: 12 });
  });

  test('獲得標高を入力すると、onUpdateDraftがminElevationGainMetersで呼ばれる', () => {
    const onUpdateDraft = vi.fn();
    renderDialog({ onUpdateDraft });

    fireEvent.change(screen.getByLabelText('獲得標高'), { target: { value: '500' } });

    expect(onUpdateDraft).toHaveBeenCalledWith({ minElevationGainMeters: 500 });
  });

  test('平均時速を入力すると、onUpdateDraftがminAverageSpeedKmhで呼ばれる', () => {
    const onUpdateDraft = vi.fn();
    renderDialog({ onUpdateDraft });

    fireEvent.change(screen.getByLabelText('平均時速'), { target: { value: '25.5' } });

    expect(onUpdateDraft).toHaveBeenCalledWith({ minAverageSpeedKmh: 25.5 });
  });

  test('走行距離を入力すると、onUpdateDraftがminDistanceKmで呼ばれる', () => {
    const onUpdateDraft = vi.fn();
    renderDialog({ onUpdateDraft });

    fireEvent.change(screen.getByLabelText('走行距離'), { target: { value: '30.5' } });

    expect(onUpdateDraft).toHaveBeenCalledWith({ minDistanceKm: 30.5 });
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

  test('月のみ入力され年が未入力の場合、実行ボタンが無効化され検証メッセージが表示される', () => {
    renderDialog({ draftFilter: { ...DEFAULT_ACTIVITY_FILTER, startMonth: 3 } });

    expect(screen.getByRole('button', { name: '実行' })).toBeDisabled();
    expect(
      screen.getByText('年月を範囲指定する場合、年も入力してください（月のみの指定はできません）')
    ).toBeInTheDocument();
  });

  test('閉じるボタンを押すと、onCloseが呼ばれる', () => {
    const onClose = vi.fn();
    renderDialog({ onClose });

    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
