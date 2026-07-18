import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { CyclingActivity } from '../../api/activitiesApi';
import { renderWithChakra } from '../../test-utils/renderWithChakra';
import { DEFAULT_ACTIVITY_FILTER } from '../../types/activityFilter';
import type { LayerVisibility } from '../../types/layer';
import { MUNICIPALITY_ERA_CURRENT } from '../../types/municipalityEra';
import { MapControls } from '../MapControls';

const DEFAULT_VISIBILITY: LayerVisibility = {
  'osm-poi': true,
  'osm-road': true,
  'osm-building': true,
  'osm-place-name': true,
  'admin-boundary': true,
  'aerial-photo': false,
  'bicycle-log': false
};

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

const renderControls = (overrides: Partial<Parameters<typeof MapControls>[0]> = {}) =>
  renderWithChakra(
    <MapControls
      appliedVisibility={DEFAULT_VISIBILITY}
      appliedEra={MUNICIPALITY_ERA_CURRENT}
      onApplyLayerSettings={vi.fn()}
      appliedFilter={DEFAULT_ACTIVITY_FILTER}
      onApplyFilter={vi.fn()}
      activities={[]}
      isBackfillRunning={false}
      onStartBackfill={vi.fn()}
      onStartForceRefetch={vi.fn()}
      {...overrides}
    />
  );

describe('MapControlsに関するテスト', () => {
  test('レイヤー・フィルタ・統計・設定の4つのアイコンボタンが表示される', () => {
    renderControls();

    expect(screen.getByRole('button', { name: 'レイヤー切り替え' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '自転車ログ フィルタ' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '統計データ' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '設定' })).toBeInTheDocument();
  });

  test('レイヤーアイコンを押すと、レイヤー切り替えダイアログが開く', async () => {
    renderControls();

    fireEvent.click(screen.getByRole('button', { name: 'レイヤー切り替え' }));

    await waitFor(() => expect(screen.getByRole('checkbox', { name: '道路' })).toBeInTheDocument());
  });

  test('レイヤーダイアログで実行すると、onApplyLayerSettingsが呼ばれダイアログが閉じる', async () => {
    const onApplyLayerSettings = vi.fn();
    renderControls({ onApplyLayerSettings });
    fireEvent.click(screen.getByRole('button', { name: 'レイヤー切り替え' }));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: '道路' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: '実行' }));

    expect(onApplyLayerSettings).toHaveBeenCalledWith(DEFAULT_VISIBILITY, MUNICIPALITY_ERA_CURRENT);
    await waitFor(() => expect(screen.queryByRole('checkbox', { name: '道路' })).not.toBeInTheDocument());
  });

  test('フィルタアイコンを押すと、フィルタダイアログが開く', async () => {
    renderControls();

    fireEvent.click(screen.getByRole('button', { name: '自転車ログ フィルタ' }));

    await waitFor(() => expect(screen.getByLabelText('獲得標高')).toBeInTheDocument());
  });

  test('フィルタダイアログで実行すると、onApplyFilterが呼ばれダイアログが閉じる', async () => {
    const onApplyFilter = vi.fn();
    renderControls({ onApplyFilter });
    fireEvent.click(screen.getByRole('button', { name: '自転車ログ フィルタ' }));
    await waitFor(() => expect(screen.getByLabelText('獲得標高')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: '実行' }));

    expect(onApplyFilter).toHaveBeenCalledWith(DEFAULT_ACTIVITY_FILTER);
    await waitFor(() => expect(screen.queryByLabelText('獲得標高')).not.toBeInTheDocument());
  });

  test('統計アイコンを押すと、統計ダイアログが全アクティビティ数とともに開く', async () => {
    renderControls({ activities: [createActivity({ id: '1' }), createActivity({ id: '2' })] });

    fireEvent.click(screen.getByRole('button', { name: '統計データ' }));

    await waitFor(() => expect(screen.getByText('全アクティビティ数: 2件')).toBeInTheDocument());
  });

  test('設定アイコンを押すと、設定ダイアログが開く', async () => {
    renderControls();

    fireEvent.click(screen.getByRole('button', { name: '設定' }));

    await waitFor(() => expect(screen.getByRole('button', { name: '自転車ログ初期取り込み' })).toBeInTheDocument());
  });

  test('設定ダイアログの初期取り込みボタンを押すと、onStartBackfillが呼ばれる', async () => {
    const onStartBackfill = vi.fn();
    renderControls({ onStartBackfill });
    fireEvent.click(screen.getByRole('button', { name: '設定' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '自転車ログ初期取り込み' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: '自転車ログ初期取り込み' }));

    expect(onStartBackfill).toHaveBeenCalledTimes(1);
  });
});
