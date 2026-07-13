import { fireEvent, waitFor } from '@testing-library/react';
import maplibregl from 'maplibre-gl';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { CyclingActivity } from '../../api/activitiesApi';
import { renderWithChakra } from '../../test-utils/renderWithChakra';
import { MapWorkspace } from '../MapWorkspace';

vi.mock('../../api/activitiesApi', () => ({
  fetchCyclingActivities: vi.fn().mockResolvedValue([]),
  syncCyclingActivities: vi.fn().mockResolvedValue({ success: true }),
  startBackfill: vi.fn().mockResolvedValue({ started: true }),
  startForceRefetch: vi.fn().mockResolvedValue({ started: true }),
  fetchPassedMunicipalities: vi.fn().mockResolvedValue([]),
  getBackfillStatus: vi.fn().mockResolvedValue({
    isRunning: false,
    totalCount: 0,
    completedCount: 0,
    progressPercent: 0,
    estimatedRemainingSeconds: null,
    lastError: null
  })
}));

const FIXTURE_STYLE_LAYERS = [
  { id: 'background', type: 'background' },
  { id: 'road_motorway', type: 'line', 'source-layer': 'transportation' },
  { id: 'building', type: 'fill', 'source-layer': 'building' },
  { id: 'poi_r1', type: 'symbol', 'source-layer': 'poi' },
  { id: 'label_city', type: 'symbol', 'source-layer': 'place' }
];

vi.mock('maplibre-gl', () => {
  const remove = vi.fn();
  const once = vi.fn((event: string, callback: () => void) => {
    if (event === 'load') {
      callback();
    }
  });
  const getStyle = vi.fn(() => ({ layers: FIXTURE_STYLE_LAYERS }));
  const addSource = vi.fn();
  const addLayer = vi.fn();
  const setLayoutProperty = vi.fn();
  const setData = vi.fn();
  const getSource = vi.fn(() => ({ setData }));
  const on = vi.fn();
  const queryRenderedFeatures = vi.fn(() => []);
  const setFeatureState = vi.fn();
  const MapMock = vi.fn().mockImplementation(function MockMap() {
    return {
      remove,
      once,
      getStyle,
      addSource,
      addLayer,
      setLayoutProperty,
      getSource,
      on,
      queryRenderedFeatures,
      setFeatureState
    };
  });
  // biome-ignore lint/style/useNamingConvention: maplibre-glの実APIに合わせクラス名(Map)をPascalCaseのまま公開する
  return { default: { Map: MapMock } };
});

const getMapInstance = () => vi.mocked(maplibregl.Map).mock.results[0].value;

/** mapInstance.onで登録された'click'ハンドラを取り出す */
const getClickHandler = (mapInstance: ReturnType<typeof getMapInstance>) => {
  const call = mapInstance.on.mock.calls.find(([event]: [string]) => event === 'click');
  return call?.[1];
};

const createActivity = (overrides: Partial<CyclingActivity>): CyclingActivity => ({
  id: '1',
  name: 'テストライド',
  distanceMeters: 20000,
  movingTimeSeconds: 3600,
  elapsedTimeSeconds: 3900,
  elevationGainMeters: 50,
  startDate: '2026-06-15T01:00:00.000Z',
  path: null,
  ...overrides
});

describe('MapWorkspaceに関するテスト', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('道路レイヤーのトグルをOFFにすると、地図の道路レイヤーが非表示になる', async () => {
    const { getByRole } = renderWithChakra(<MapWorkspace />);
    const mapInstance = getMapInstance();
    mapInstance.setLayoutProperty.mockClear();

    fireEvent.click(getByRole('checkbox', { name: '道路' }));

    await waitFor(() =>
      expect(mapInstance.setLayoutProperty).toHaveBeenCalledWith('road_motorway', 'visibility', 'none')
    );
  });

  test('航空写真レイヤーのトグルをONにすると、地図の航空写真レイヤーが表示される', async () => {
    const { getByRole } = renderWithChakra(<MapWorkspace />);
    const mapInstance = getMapInstance();
    mapInstance.setLayoutProperty.mockClear();

    fireEvent.click(getByRole('checkbox', { name: '航空写真' }));

    await waitFor(() =>
      expect(mapInstance.setLayoutProperty).toHaveBeenCalledWith('aerial-photo-layer', 'visibility', 'visible')
    );
  });

  test('初期取り込みボタンをクリックすると、startBackfillが呼ばれる', async () => {
    const { startBackfill } = await import('../../api/activitiesApi');
    const { getByRole } = renderWithChakra(<MapWorkspace />);

    fireEvent.click(getByRole('button', { name: '自転車ログ初期取り込み' }));

    await waitFor(() => expect(startBackfill).toHaveBeenCalledTimes(1));
  });

  test('強制再取得ボタンをクリックすると、startForceRefetchが呼ばれる', async () => {
    const { startForceRefetch } = await import('../../api/activitiesApi');
    const { getByRole } = renderWithChakra(<MapWorkspace />);

    fireEvent.click(getByRole('button', { name: '自転車ログ強制再取得' }));

    await waitFor(() => expect(startForceRefetch).toHaveBeenCalledTimes(1));
  });

  // ダイアログの開閉・入力・地図クリックと複数回のwaitForを経る重いテストのため、
  // フルスイート並列実行時のCPU負荷でデフォルトタイムアウト(5000ms)を超えることがあるため延長する
  test('選択・フォーカス中のアクティビティがフィルタで除外されると、選択・フォーカスが解除される', async () => {
    const { fetchCyclingActivities } = await import('../../api/activitiesApi');
    const startDate = '2026-06-15T01:00:00.000Z';
    const formattedStartDate = new Date(startDate).toLocaleString('ja-JP');
    vi.mocked(fetchCyclingActivities).mockResolvedValue([
      createActivity({ id: 'low', elevationGainMeters: 50, startDate }),
      createActivity({ id: 'high', elevationGainMeters: 200, startDate })
    ]);
    const { getByRole, getByLabelText, queryByText, getByText } = renderWithChakra(<MapWorkspace />);

    fireEvent.click(getByRole('checkbox', { name: '自転車ログ' }));
    const mapInstance = getMapInstance();
    await waitFor(() => expect(fetchCyclingActivities).toHaveBeenCalled());

    mapInstance.queryRenderedFeatures.mockReturnValue([{ properties: { id: 'low' } }, { properties: { id: 'high' } }]);
    const clickHandler = getClickHandler(mapInstance);
    clickHandler({ point: { x: 0, y: 0 } });

    await waitFor(() => expect(getByText(`1. ${formattedStartDate}`)).toBeInTheDocument());
    fireEvent.click(getByText(`1. ${formattedStartDate}`));
    await waitFor(() => expect(getByText('獲得標高: 50 m')).toBeInTheDocument());

    fireEvent.click(getByRole('button', { name: '自転車ログ フィルタ' }));
    await waitFor(() => expect(getByLabelText('獲得標高')).toBeInTheDocument());
    fireEvent.change(getByLabelText('獲得標高'), { target: { value: '100' } });
    fireEvent.click(getByRole('button', { name: '実行' }));

    await waitFor(() => expect(queryByText('獲得標高: 50 m')).not.toBeInTheDocument());
    expect(getByText(`1. ${formattedStartDate}`)).toBeInTheDocument();
  }, 10000);

  test('複数のエラーが発生した場合、エラーダイアログにスタックして表示される', async () => {
    // モーダルダイアログが一度開くと背後の要素はaria-hiddenになり操作できなくなるため、
    // ダイアログが開くより前（マウント直後）に2つの独立した非同期処理を同時に走らせて検証する。
    const { getBackfillStatus, fetchCyclingActivities } = await import('../../api/activitiesApi');
    vi.mocked(getBackfillStatus).mockRejectedValue(new Error('status fetch failed'));
    vi.mocked(fetchCyclingActivities).mockRejectedValue(new Error('fetch failed'));
    const { getByRole } = renderWithChakra(<MapWorkspace />);

    fireEvent.click(getByRole('checkbox', { name: '自転車ログ' }));

    await waitFor(() => {
      expect(getByRole('heading', { name: 'エラーが発生しました（1/2）' })).toBeInTheDocument();
    });
  });
});
