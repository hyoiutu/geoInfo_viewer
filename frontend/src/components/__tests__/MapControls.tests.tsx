import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { createStore } from 'jotai';
import { describe, expect, test, vi } from 'vitest';
import type { CyclingActivity } from '../../api/activitiesApi';
import { clearPendingLayerApplyFlagAtom, startPendingLayerApplyAtom } from '../../atoms/isApplyingLayerSettingsAtom';
import { renderWithChakra } from '../../test-utils/renderWithChakra';
import { DEFAULT_ACTIVITY_FILTER } from '../../types/activityFilter';
import type { LayerVisibility } from '../../types/layer';
import { MUNICIPALITY_ERA_CURRENT } from '../../types/municipalityEra';
import { MapControls } from '../MapControls';

// 「一定時間待っても発生しないこと」を確認するためのwaitForタイムアウト（ミリ秒）。
// 短時間で確実に打ち切りたいだけであり、実際の非同期処理の所要時間とは無関係な値のため定数化する
const ASSERT_NOT_YET_TIMEOUT_MS = 200;

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
  summaryPath: null,
  ...overrides
});

const buildControls = (overrides: Partial<Parameters<typeof MapControls>[0]> = {}) => (
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

/** テスト専用のストアでレンダリングする。戻り値のstoreを使ってisApplyingLayerSettingsAtomを直接操作できる */
const renderControls = (overrides: Partial<Parameters<typeof MapControls>[0]> = {}) => {
  const store = createStore();
  return { ...renderWithChakra(buildControls(overrides), { store }), store };
};

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

  test('レイヤーダイアログで何も変更せず実行すると、onApplyLayerSettingsが呼ばれダイアログはすぐに閉じる', async () => {
    const onApplyLayerSettings = vi.fn();
    renderControls({ onApplyLayerSettings });
    fireEvent.click(screen.getByRole('button', { name: 'レイヤー切り替え' }));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: '道路' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: '実行' }));

    expect(onApplyLayerSettings).toHaveBeenCalledWith(DEFAULT_VISIBILITY, MUNICIPALITY_ERA_CURRENT);
    await waitFor(() => expect(screen.queryByRole('checkbox', { name: '道路' })).not.toBeInTheDocument());
  });

  describe('非同期処理を伴うレイヤー変更の実行に関するテスト（Issue #65）', () => {
    test('行政区画の年代を変更して実行すると、ダイアログはすぐには閉じず、適用が完了してから閉じる', async () => {
      const onApplyLayerSettings = vi.fn();
      const { store } = renderControls({ onApplyLayerSettings });
      fireEvent.click(screen.getByRole('button', { name: 'レイヤー切り替え' }));
      await waitFor(() => expect(screen.getByRole('checkbox', { name: '道路' })).toBeInTheDocument());
      fireEvent.change(screen.getByLabelText('行政区画の年代'), { target: { value: '2000-10-01' } });

      fireEvent.click(screen.getByRole('button', { name: '実行' }));

      expect(onApplyLayerSettings).toHaveBeenCalledWith(DEFAULT_VISIBILITY, '2000-10-01');
      // MapWorkspace側がonApplyLayerSettings呼び出しと同じタイミングで行う、isApplyingLayerSettingsAtomの
      // 更新をここで模擬する。適用中フラグがtrueになっても、一定時間待ってもダイアログは閉じない
      act(() => {
        store.set(startPendingLayerApplyAtom, { waitingForAdminBoundary: true, waitingForCyclingLog: false });
      });
      await expect(
        waitFor(() => expect(screen.queryByRole('checkbox', { name: '道路' })).not.toBeInTheDocument(), {
          timeout: ASSERT_NOT_YET_TIMEOUT_MS
        })
      ).rejects.toThrow();

      // 適用中フラグがfalseに戻った時点でダイアログが閉じる
      act(() => {
        store.set(clearPendingLayerApplyFlagAtom, 'waitingForAdminBoundary');
      });
      await waitFor(() => expect(screen.queryByRole('checkbox', { name: '道路' })).not.toBeInTheDocument());
    });

    test('自転車ログをOFF→ONにして実行すると、ダイアログはすぐには閉じず、適用が完了してから閉じる', async () => {
      const onApplyLayerSettings = vi.fn();
      const { store } = renderControls({ onApplyLayerSettings });
      fireEvent.click(screen.getByRole('button', { name: 'レイヤー切り替え' }));
      await waitFor(() => expect(screen.getByRole('checkbox', { name: '自転車ログ' })).toBeInTheDocument());
      fireEvent.click(screen.getByRole('checkbox', { name: '自転車ログ' }));
      await waitFor(() => expect(screen.getByRole('checkbox', { name: '自転車ログ' })).toBeChecked());

      fireEvent.click(screen.getByRole('button', { name: '実行' }));

      expect(onApplyLayerSettings).toHaveBeenCalledWith(
        { ...DEFAULT_VISIBILITY, 'bicycle-log': true },
        MUNICIPALITY_ERA_CURRENT
      );
      act(() => {
        store.set(startPendingLayerApplyAtom, { waitingForAdminBoundary: false, waitingForCyclingLog: true });
      });
      await expect(
        waitFor(() => expect(screen.queryByRole('checkbox', { name: '自転車ログ' })).not.toBeInTheDocument(), {
          timeout: ASSERT_NOT_YET_TIMEOUT_MS
        })
      ).rejects.toThrow();

      act(() => {
        store.set(clearPendingLayerApplyFlagAtom, 'waitingForCyclingLog');
      });
      await waitFor(() => expect(screen.queryByRole('checkbox', { name: '自転車ログ' })).not.toBeInTheDocument());
    });

    test('自転車ログをON→OFFにして実行しても、待たずにすぐ閉じる（非同期処理が発生しないため）', async () => {
      const onApplyLayerSettings = vi.fn();
      renderControls({
        onApplyLayerSettings,
        appliedVisibility: { ...DEFAULT_VISIBILITY, 'bicycle-log': true }
      });
      fireEvent.click(screen.getByRole('button', { name: 'レイヤー切り替え' }));
      await waitFor(() => expect(screen.getByRole('checkbox', { name: '自転車ログ' })).toBeInTheDocument());
      fireEvent.click(screen.getByRole('checkbox', { name: '自転車ログ' }));
      await waitFor(() => expect(screen.getByRole('checkbox', { name: '自転車ログ' })).not.toBeChecked());

      fireEvent.click(screen.getByRole('button', { name: '実行' }));

      await waitFor(() => expect(screen.queryByRole('checkbox', { name: '自転車ログ' })).not.toBeInTheDocument());
    });
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
