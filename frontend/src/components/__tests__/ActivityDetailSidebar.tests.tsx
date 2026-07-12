import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { CyclingActivity } from '../../api/activitiesApi';
import { renderWithChakra } from '../../test-utils/renderWithChakra';
import { ActivityDetailSidebar } from '../ActivityDetailSidebar';

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

describe('ActivityDetailSidebarに関するテスト', () => {
  test('activitiesが空の場合、何も表示しない', () => {
    const { container } = renderWithChakra(
      <ActivityDetailSidebar
        activities={[]}
        focusedIndex={null}
        onFocus={vi.fn()}
        onBackFromDetail={vi.fn()}
        onBackFromList={vi.fn()}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  test('未フォーカスの場合、選択中アクティビティの走行開始日時一覧を通し番号付きで表示する', () => {
    const activities = [
      createActivity({ id: '1', startDate: '2026-07-01T01:00:00.000Z' }),
      createActivity({ id: '2', startDate: '2026-07-02T01:00:00.000Z' })
    ];

    renderWithChakra(
      <ActivityDetailSidebar
        activities={activities}
        focusedIndex={null}
        onFocus={vi.fn()}
        onBackFromDetail={vi.fn()}
        onBackFromList={vi.fn()}
      />
    );

    expect(screen.getByText(`1. ${new Date('2026-07-01T01:00:00.000Z').toLocaleString('ja-JP')}`)).toBeInTheDocument();
    expect(screen.getByText(`2. ${new Date('2026-07-02T01:00:00.000Z').toLocaleString('ja-JP')}`)).toBeInTheDocument();
  });

  test('一覧の項目をクリックすると、そのインデックスでonFocusが呼ばれる', () => {
    const onFocus = vi.fn();
    const activities = [createActivity({ id: '1' }), createActivity({ id: '2' })];

    renderWithChakra(
      <ActivityDetailSidebar
        activities={activities}
        focusedIndex={null}
        onFocus={onFocus}
        onBackFromDetail={vi.fn()}
        onBackFromList={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText(`2. ${new Date('2026-07-01T01:00:00.000Z').toLocaleString('ja-JP')}`));

    expect(onFocus).toHaveBeenCalledWith(1);
  });

  test('一覧画面の戻るボタンを押すと、onBackFromListが呼ばれる', () => {
    const onBackFromList = vi.fn();

    renderWithChakra(
      <ActivityDetailSidebar
        activities={[createActivity({})]}
        focusedIndex={null}
        onFocus={vi.fn()}
        onBackFromDetail={vi.fn()}
        onBackFromList={onBackFromList}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: '戻る' }));

    expect(onBackFromList).toHaveBeenCalledTimes(1);
  });

  test('フォーカス中の場合、アクティビティの詳細（名前・距離・獲得標高・開始/終了日時・平均時速）を表示する', () => {
    const activity = createActivity({
      name: '朝ライド',
      distanceMeters: 36000,
      movingTimeSeconds: 3600,
      elapsedTimeSeconds: 3900,
      elevationGainMeters: 250.5,
      startDate: '2026-07-01T01:00:00.000Z'
    });

    renderWithChakra(
      <ActivityDetailSidebar
        activities={[activity]}
        focusedIndex={0}
        onFocus={vi.fn()}
        onBackFromDetail={vi.fn()}
        onBackFromList={vi.fn()}
      />
    );

    expect(screen.getByText('朝ライド')).toBeInTheDocument();
    expect(screen.getByText('走行距離: 36.0 km')).toBeInTheDocument();
    expect(screen.getByText('獲得標高: 251 m')).toBeInTheDocument();
    expect(screen.getByText('平均時速: 36.0 km/h')).toBeInTheDocument();
  });

  test('詳細画面の戻るボタンを押すと、onBackFromDetailが呼ばれる', () => {
    const onBackFromDetail = vi.fn();

    renderWithChakra(
      <ActivityDetailSidebar
        activities={[createActivity({})]}
        focusedIndex={0}
        onFocus={vi.fn()}
        onBackFromDetail={onBackFromDetail}
        onBackFromList={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: '戻る' }));

    expect(onBackFromDetail).toHaveBeenCalledTimes(1);
  });
});
