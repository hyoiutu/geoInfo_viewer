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

vi.mock('../../api/municipalitiesApi', () => ({
  fetchMunicipalityBoundaries: vi.fn().mockResolvedValue({ type: 'FeatureCollection', features: [] })
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
  const addControl = vi.fn();
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
      setFeatureState,
      addControl
    };
  });
  const AttributionControlMock = vi.fn();
  // biome-ignore lint/style/useNamingConvention: maplibre-glの実APIに合わせクラス名(Map/AttributionControl)をPascalCaseのまま公開する
  return { default: { Map: MapMock, AttributionControl: AttributionControlMock } };
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

/**
 * レイヤー切り替えダイアログを開き、指定したレイヤーのチェックボックスを切り替えて実行する。
 * Chakra UIのCheckboxのonCheckedChangeは非同期のため、チェック状態の反映をwaitForで待つ
 */
const toggleLayerViaDialog = async (getByRole: ReturnType<typeof renderWithChakra>['getByRole'], layerName: string) => {
  fireEvent.click(getByRole('button', { name: 'レイヤー切り替え' }));
  const checkbox = await waitFor(() => getByRole('checkbox', { name: layerName }));
  const wasChecked =
    checkbox.getAttribute('aria-checked') === 'true' || (checkbox instanceof HTMLInputElement && checkbox.checked);
  fireEvent.click(checkbox);
  await waitFor(() => {
    const updated = getByRole('checkbox', { name: layerName });
    expect(updated instanceof HTMLInputElement && updated.checked).toBe(!wasChecked);
  });
  fireEvent.click(getByRole('button', { name: '実行' }));
};

describe('MapWorkspaceに関するテスト', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('道路レイヤーのトグルをOFFにして実行すると、地図の道路レイヤーが非表示になる', async () => {
    const { getByRole } = renderWithChakra(<MapWorkspace />);
    const mapInstance = getMapInstance();
    mapInstance.setLayoutProperty.mockClear();

    await toggleLayerViaDialog(getByRole, '道路');

    await waitFor(() =>
      expect(mapInstance.setLayoutProperty).toHaveBeenCalledWith('road_motorway', 'visibility', 'none')
    );
  });

  test('航空写真レイヤーのトグルをONにして実行すると、地図の航空写真レイヤーが表示される', async () => {
    const { getByRole } = renderWithChakra(<MapWorkspace />);
    const mapInstance = getMapInstance();
    mapInstance.setLayoutProperty.mockClear();

    await toggleLayerViaDialog(getByRole, '航空写真');

    await waitFor(() =>
      expect(mapInstance.setLayoutProperty).toHaveBeenCalledWith('aerial-photo-layer', 'visibility', 'visible')
    );
  });

  test('統計アイコンをクリックすると、統計ダイアログに全アクティビティ数と総走行距離数が表示される', async () => {
    const { fetchCyclingActivities } = await import('../../api/activitiesApi');
    vi.mocked(fetchCyclingActivities).mockResolvedValue([
      createActivity({ id: 'a', distanceMeters: 12345 }),
      createActivity({ id: 'b', distanceMeters: 7655 })
    ]);
    const { getByRole, getByText } = renderWithChakra(<MapWorkspace />);

    await toggleLayerViaDialog(getByRole, '自転車ログ');
    await waitFor(() => expect(fetchCyclingActivities).toHaveBeenCalled());

    fireEvent.click(getByRole('button', { name: '統計データ' }));

    await waitFor(() => expect(getByText('全アクティビティ数: 2件')).toBeInTheDocument());
    expect(getByText('総走行距離数: 20.0 km')).toBeInTheDocument();
  });

  test('設定ダイアログの初期取り込みボタンをクリックすると、startBackfillが呼ばれる', async () => {
    const { startBackfill } = await import('../../api/activitiesApi');
    const { getByRole } = renderWithChakra(<MapWorkspace />);

    fireEvent.click(getByRole('button', { name: '設定' }));
    const backfillButton = await waitFor(() => getByRole('button', { name: '自転車ログ初期取り込み' }));
    fireEvent.click(backfillButton);

    await waitFor(() => expect(startBackfill).toHaveBeenCalledTimes(1));
  });

  test('設定ダイアログの強制再取得ボタンをクリックすると、startForceRefetchが呼ばれる', async () => {
    const { startForceRefetch } = await import('../../api/activitiesApi');
    const { getByRole } = renderWithChakra(<MapWorkspace />);

    fireEvent.click(getByRole('button', { name: '設定' }));
    const forceRefetchButton = await waitFor(() => getByRole('button', { name: '自転車ログ強制再取得' }));
    fireEvent.click(forceRefetchButton);

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

    await toggleLayerViaDialog(getByRole, '自転車ログ');
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

  test('通過自治体一覧の項目をクリックすると、行政区画フォーカス用オーバーレイへ反映される（Issue #76）', async () => {
    const { fetchCyclingActivities, fetchPassedMunicipalities } = await import('../../api/activitiesApi');
    const { fetchMunicipalityBoundaries } = await import('../../api/municipalitiesApi');
    const startDate = '2026-06-15T01:00:00.000Z';
    const formattedStartDate = new Date(startDate).toLocaleString('ja-JP');
    vi.mocked(fetchCyclingActivities).mockResolvedValue([createActivity({ id: 'low', startDate })]);
    vi.mocked(fetchPassedMunicipalities).mockResolvedValue([{ prefectureName: '東京都', municipalityName: '渋谷区' }]);
    const shibuyaFeature = {
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [139.7, 35.6] },
      properties: { prefectureName: '東京都', municipalityName: '渋谷区' }
    };
    vi.mocked(fetchMunicipalityBoundaries).mockResolvedValue({
      type: 'FeatureCollection',
      features: [shibuyaFeature]
    });
    const { getByRole, getByText } = renderWithChakra(<MapWorkspace />);

    await toggleLayerViaDialog(getByRole, '自転車ログ');
    const mapInstance = getMapInstance();
    await waitFor(() => expect(fetchCyclingActivities).toHaveBeenCalled());

    mapInstance.queryRenderedFeatures.mockReturnValue([{ properties: { id: 'low' } }]);
    const clickHandler = getClickHandler(mapInstance);
    clickHandler({ point: { x: 0, y: 0 } });
    await waitFor(() => expect(getByText(`1. ${formattedStartDate}`)).toBeInTheDocument());
    fireEvent.click(getByText(`1. ${formattedStartDate}`));
    await waitFor(() => expect(getByText('東京都渋谷区')).toBeInTheDocument());

    fireEvent.click(getByText('東京都渋谷区'));

    await waitFor(() => {
      const setDataMock = mapInstance.getSource('any-source-id').setData;
      expect(setDataMock).toHaveBeenCalledWith({ type: 'FeatureCollection', features: [shibuyaFeature] });
    });
  });

  test('複数のエラーが発生した場合、エラーダイアログにスタックして表示される', async () => {
    // モーダルダイアログが一度開くと背後の要素はaria-hiddenになり操作できなくなるため、
    // マウント時に自動発生する1件目のエラー（getBackfillStatus）を意図的に遅延させ、
    // レイヤー切り替えダイアログの操作（2件目のエラーfetchCyclingActivitiesを誘発する）が
    // ブロックされる前に完了できるようにする。
    const { getBackfillStatus, fetchCyclingActivities } = await import('../../api/activitiesApi');
    vi.mocked(getBackfillStatus).mockImplementation(
      () => new Promise((_resolve, reject) => setTimeout(() => reject(new Error('status fetch failed')), 500))
    );
    vi.mocked(fetchCyclingActivities).mockRejectedValue(new Error('fetch failed'));
    const { getByRole } = renderWithChakra(<MapWorkspace />);

    await toggleLayerViaDialog(getByRole, '自転車ログ');

    await waitFor(() => {
      expect(getByRole('heading', { name: 'エラーが発生しました（1/2）' })).toBeInTheDocument();
    });
  });
});
