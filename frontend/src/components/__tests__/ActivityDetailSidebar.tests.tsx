import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { CyclingActivity } from '../../api/activitiesApi';
import { fetchPassedMunicipalities } from '../../api/activitiesApi';
import { ErrorsProbe } from '../../test-utils/ErrorsProbe';
import { renderWithChakra } from '../../test-utils/renderWithChakra';
import { ActivityDetailSidebar } from '../ActivityDetailSidebar';

vi.mock('../../api/activitiesApi', () => ({
  fetchPassedMunicipalities: vi.fn()
}));

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
  beforeEach(() => {
    vi.mocked(fetchPassedMunicipalities).mockResolvedValue([]);
  });

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

  test('フォーカス中の場合、対象アクティビティのIDで通過自治体を取得し一覧表示する', async () => {
    vi.mocked(fetchPassedMunicipalities).mockResolvedValue([
      { prefectureName: '東京都', municipalityName: '千代田区' },
      { prefectureName: '神奈川県', municipalityName: '横浜市中区' }
    ]);
    const activity = createActivity({ id: '42' });

    renderWithChakra(
      <ActivityDetailSidebar
        activities={[activity]}
        focusedIndex={0}
        onFocus={vi.fn()}
        onBackFromDetail={vi.fn()}
        onBackFromList={vi.fn()}
      />
    );

    expect(fetchPassedMunicipalities).toHaveBeenCalledWith('42', 'current');
    await waitFor(() => {
      expect(screen.getByText('東京都千代田区')).toBeInTheDocument();
    });
    expect(screen.getByText('神奈川県横浜市中区')).toBeInTheDocument();
  });

  test('adminBoundaryEraを指定した場合、その年代で通過自治体を取得する', () => {
    const activity = createActivity({ id: '42' });

    renderWithChakra(
      <ActivityDetailSidebar
        activities={[activity]}
        focusedIndex={0}
        onFocus={vi.fn()}
        onBackFromDetail={vi.fn()}
        onBackFromList={vi.fn()}
        adminBoundaryEra="2000-10-01"
      />
    );

    expect(fetchPassedMunicipalities).toHaveBeenCalledWith('42', '2000-10-01');
  });

  test('通過自治体が無い場合、その旨を表示する', async () => {
    vi.mocked(fetchPassedMunicipalities).mockResolvedValue([]);

    renderWithChakra(
      <ActivityDetailSidebar
        activities={[createActivity({})]}
        focusedIndex={0}
        onFocus={vi.fn()}
        onBackFromDetail={vi.fn()}
        onBackFromList={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('該当する自治体はありません')).toBeInTheDocument();
    });
  });

  test('通過自治体の取得に失敗した場合、グローバルなエラースタックに追加される', async () => {
    vi.mocked(fetchPassedMunicipalities).mockRejectedValue(new Error('fetch failed'));

    renderWithChakra(
      <>
        <ActivityDetailSidebar
          activities={[createActivity({})]}
          focusedIndex={0}
          onFocus={vi.fn()}
          onBackFromDetail={vi.fn()}
          onBackFromList={vi.fn()}
        />
        <ErrorsProbe />
      </>
    );

    await waitFor(() => {
      expect(screen.getByTestId('errors-probe').textContent).toContain('fetch failed');
    });
  });
});
