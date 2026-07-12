import { fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { renderWithChakra } from '../../test-utils/renderWithChakra';
import { LayerSidebar } from '../LayerSidebar';

const LAYERS = [
  { id: 'osm-poi' as const, name: 'POI', checked: true },
  { id: 'osm-road' as const, name: '道路', checked: true },
  { id: 'aerial-photo' as const, name: '航空写真', checked: false }
];

const NOT_RUNNING_BACKFILL_STATUS = {
  isRunning: false,
  totalCount: 0,
  completedCount: 0,
  progressPercent: 0,
  estimatedRemainingSeconds: null,
  lastError: null
};

const RUNNING_BACKFILL_STATUS = {
  isRunning: true,
  totalCount: 4,
  completedCount: 1,
  progressPercent: 25,
  estimatedRemainingSeconds: 27,
  lastError: null
};

const renderSidebar = (overrides: Partial<Parameters<typeof LayerSidebar>[0]> = {}) =>
  renderWithChakra(
    <LayerSidebar
      layers={LAYERS}
      onToggleLayer={vi.fn()}
      backfillStatus={NOT_RUNNING_BACKFILL_STATUS}
      onStartBackfill={vi.fn()}
      onStartForceRefetch={vi.fn()}
      {...overrides}
    />
  );

describe('LayerSidebarに関するテスト', () => {
  test('レンダリングされたとき、各レイヤー名が表示される', () => {
    const { getByText } = renderSidebar();

    expect(getByText('POI')).toBeInTheDocument();
    expect(getByText('道路')).toBeInTheDocument();
    expect(getByText('航空写真')).toBeInTheDocument();
  });

  test('レンダリングされたとき、checked=trueのレイヤーのトグルはONになっている', () => {
    const { getByRole } = renderSidebar();

    expect(getByRole('checkbox', { name: 'POI' })).toBeChecked();
  });

  test('レンダリングされたとき、checked=falseのレイヤーのトグルはOFFになっている', () => {
    const { getByRole } = renderSidebar();

    expect(getByRole('checkbox', { name: '航空写真' })).not.toBeChecked();
  });

  test('トグルをクリックすると、onToggleLayerが対象のレイヤーIDで呼ばれる', async () => {
    const onToggleLayer = vi.fn();
    const { getByRole } = renderSidebar({ onToggleLayer });

    fireEvent.click(getByRole('checkbox', { name: '道路' }));

    await waitFor(() => expect(onToggleLayer).toHaveBeenCalledWith('osm-road'));
  });

  test('初期状態では、レイヤー一覧が表示されている', () => {
    const { getByText } = renderSidebar();

    expect(getByText('POI')).toBeVisible();
  });

  test('折りたたみボタンをクリックすると、レイヤー一覧が非表示になる', () => {
    const { getByRole, queryByText } = renderSidebar();

    fireEvent.click(getByRole('button', { name: 'サイドバーを折りたたむ' }));

    expect(queryByText('POI')).not.toBeInTheDocument();
  });

  test('折りたたんだ状態で展開ボタンをクリックすると、レイヤー一覧が再表示される', () => {
    const { getByRole, getByText } = renderSidebar();

    fireEvent.click(getByRole('button', { name: 'サイドバーを折りたたむ' }));
    fireEvent.click(getByRole('button', { name: 'サイドバーを展開する' }));

    expect(getByText('POI')).toBeInTheDocument();
  });

  test('レイヤー一覧の下に初期取り込みボタンが表示される', () => {
    const { getByRole } = renderSidebar();

    expect(getByRole('button', { name: '自転車ログ初期取り込み' })).toBeInTheDocument();
  });

  test('初期取り込みボタンをクリックすると、onStartBackfillが呼ばれる', () => {
    const onStartBackfill = vi.fn();
    const { getByRole } = renderSidebar({ onStartBackfill });

    fireEvent.click(getByRole('button', { name: '自転車ログ初期取り込み' }));

    expect(onStartBackfill).toHaveBeenCalledTimes(1);
  });

  test('初期取り込みが実行中でない場合、初期取り込みボタンはdisabledではない', () => {
    const { getByRole } = renderSidebar({ backfillStatus: NOT_RUNNING_BACKFILL_STATUS });

    expect(getByRole('button', { name: '自転車ログ初期取り込み' })).not.toBeDisabled();
  });

  test('初期取り込みが実行中の場合、初期取り込みボタンはdisabledになる（二重押下防止）', () => {
    const { getByRole } = renderSidebar({ backfillStatus: RUNNING_BACKFILL_STATUS });

    expect(getByRole('button', { name: '自転車ログ初期取り込み' })).toBeDisabled();
  });

  test('初期取り込みが実行中の場合、進捗率と残り時間が表示される', () => {
    const { getByText } = renderSidebar({ backfillStatus: RUNNING_BACKFILL_STATUS });

    expect(getByText(/25%/)).toBeInTheDocument();
    expect(getByText(/1\s*\/\s*4/)).toBeInTheDocument();
  });

  test('初期取り込みが実行中でない場合、進捗表示は無い', () => {
    const { queryByText } = renderSidebar({ backfillStatus: NOT_RUNNING_BACKFILL_STATUS });

    expect(queryByText(/%/)).not.toBeInTheDocument();
  });

  test('レイヤー一覧の下に強制再取得ボタンが表示される', () => {
    const { getByRole } = renderSidebar();

    expect(getByRole('button', { name: '自転車ログ強制再取得' })).toBeInTheDocument();
  });

  test('強制再取得ボタンをクリックすると、onStartForceRefetchが呼ばれる', () => {
    const onStartForceRefetch = vi.fn();
    const { getByRole } = renderSidebar({ onStartForceRefetch });

    fireEvent.click(getByRole('button', { name: '自転車ログ強制再取得' }));

    expect(onStartForceRefetch).toHaveBeenCalledTimes(1);
  });

  test('初期取り込みが実行中でない場合、強制再取得ボタンはdisabledではない', () => {
    const { getByRole } = renderSidebar({ backfillStatus: NOT_RUNNING_BACKFILL_STATUS });

    expect(getByRole('button', { name: '自転車ログ強制再取得' })).not.toBeDisabled();
  });

  test('初期取り込みが実行中の場合、強制再取得ボタンもdisabledになる（isRunningガードを共有するため）', () => {
    const { getByRole } = renderSidebar({ backfillStatus: RUNNING_BACKFILL_STATUS });

    expect(getByRole('button', { name: '自転車ログ強制再取得' })).toBeDisabled();
  });
});
