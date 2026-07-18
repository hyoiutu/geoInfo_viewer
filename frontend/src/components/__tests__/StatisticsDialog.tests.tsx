import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { CyclingActivity } from '../../api/activitiesApi';
import { renderWithChakra } from '../../test-utils/renderWithChakra';
import { StatisticsDialog } from '../StatisticsDialog';

const createActivity = (overrides: Partial<CyclingActivity>): CyclingActivity => ({
  id: '1',
  name: 'テストライド',
  distanceMeters: 12345,
  movingTimeSeconds: 3600,
  elapsedTimeSeconds: 3900,
  elevationGainMeters: 250.5,
  startDate: '2026-07-01T01:00:00.000Z',
  path: null,
  ...overrides
});

const renderDialog = (overrides: Partial<Parameters<typeof StatisticsDialog>[0]> = {}) =>
  renderWithChakra(<StatisticsDialog isOpen activities={[]} onClose={vi.fn()} {...overrides} />);

describe('StatisticsDialogに関するテスト', () => {
  test('isOpenがfalseの場合、ダイアログは表示されない', () => {
    renderDialog({ isOpen: false });

    expect(screen.queryByText('アクティビティ統計')).not.toBeInTheDocument();
  });

  test('isOpenがtrueの場合、ダイアログのタイトルと「アクティビティ統計」セクションが表示される', () => {
    renderDialog();

    expect(screen.getByText('統計データ')).toBeInTheDocument();
    expect(screen.getByText('アクティビティ統計')).toBeInTheDocument();
  });

  test('全アクティビティ数と総走行距離数が表示される', () => {
    renderDialog({
      activities: [
        createActivity({ id: '1', distanceMeters: 12345 }),
        createActivity({ id: '2', distanceMeters: 7655 })
      ]
    });

    expect(screen.getByText('全アクティビティ数: 2件')).toBeInTheDocument();
    expect(screen.getByText('総走行距離数: 20.0 km')).toBeInTheDocument();
  });

  test('アクティビティが0件の場合、0件・0.0 kmと表示される', () => {
    renderDialog({ activities: [] });

    expect(screen.getByText('全アクティビティ数: 0件')).toBeInTheDocument();
    expect(screen.getByText('総走行距離数: 0.0 km')).toBeInTheDocument();
  });

  test('閉じるボタンを押すと、onCloseが呼ばれる', () => {
    const onClose = vi.fn();
    renderDialog({ onClose });

    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
