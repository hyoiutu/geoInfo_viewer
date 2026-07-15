import { screen, waitFor } from '@testing-library/react';
import maplibregl from 'maplibre-gl';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fetchCyclingActivities, getBackfillStatus, syncCyclingActivities } from '../../api/activitiesApi';
import {
  AERIAL_PHOTO_ATTRIBUTION,
  AERIAL_PHOTO_LAYER_ID,
  AERIAL_PHOTO_SOURCE_ID,
  AERIAL_PHOTO_TILE_SIZE,
  AERIAL_PHOTO_TILE_URL
} from '../../constants/aerialPhoto';
import {
  BICYCLE_LOG_FOCUSED_LAYER_ID,
  BICYCLE_LOG_FOCUSED_SOURCE_ID,
  BICYCLE_LOG_LAYER_ID,
  BICYCLE_LOG_LINE_COLOR_DEFAULT,
  BICYCLE_LOG_LINE_COLOR_FOCUSED,
  BICYCLE_LOG_LINE_COLOR_SELECTED,
  BICYCLE_LOG_SELECTED_LAYER_ID,
  BICYCLE_LOG_SELECTED_SOURCE_ID,
  BICYCLE_LOG_SOURCE_ID
} from '../../constants/bicycleLog';
import { ErrorsProbe } from '../../test-utils/ErrorsProbe';
import { renderWithChakra } from '../../test-utils/renderWithChakra';
import { DEFAULT_ACTIVITY_FILTER } from '../../types/activityFilter';
import type { LayerVisibility } from '../../types/layer';
import { createStartMarkerElement } from '../../utils/startGoalMarkerElement';
import { MapView } from '../MapView';

vi.mock('../../api/activitiesApi', () => ({
  fetchCyclingActivities: vi.fn(),
  syncCyclingActivities: vi.fn(),
  getBackfillStatus: vi.fn()
}));

const NOT_RUNNING_BACKFILL_STATUS = {
  isRunning: false,
  totalCount: 0,
  completedCount: 0,
  progressPercent: 0,
  estimatedRemainingSeconds: null,
  lastError: null
};

const FIXTURE_STYLE_LAYERS = [
  { id: 'background', type: 'background' },
  { id: 'landcover_wood', type: 'fill', 'source-layer': 'landcover' },
  { id: 'road_motorway', type: 'line', 'source-layer': 'transportation' },
  { id: 'road_minor', type: 'line', 'source-layer': 'transportation' },
  { id: 'building', type: 'fill', 'source-layer': 'building' },
  { id: 'poi_r1', type: 'symbol', 'source-layer': 'poi' },
  { id: 'label_city', type: 'symbol', 'source-layer': 'place' }
];

const ALL_ON_VISIBILITY: LayerVisibility = {
  'osm-poi': true,
  'osm-road': true,
  'osm-building': true,
  'osm-place-name': true,
  'aerial-photo': false,
  'bicycle-log': false
};

const DEFAULT_SELECTION_PROPS = {
  selectedIds: [] as string[],
  focusedId: null as string | null,
  onSelectActivities: vi.fn(),
  onActivitiesLoaded: vi.fn(),
  filter: DEFAULT_ACTIVITY_FILTER
};

// ソースIDごとに独立したsetDataスパイを返す（BICYCLE_LOG_SOURCE_ID等、複数ソースを区別して検証するため）
const setDataMocksBySourceId: Record<string, ReturnType<typeof vi.fn>> = {};

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
  const getSource = vi.fn((sourceId: string) => {
    if (!setDataMocksBySourceId[sourceId]) {
      setDataMocksBySourceId[sourceId] = vi.fn();
    }
    return { setData: setDataMocksBySourceId[sourceId] };
  });
  const on = vi.fn();
  const queryRenderedFeatures = vi.fn(() => []);
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
      addControl
    };
  });
  const MarkerMock = vi.fn().mockImplementation(function MockMarker(options: { element: HTMLElement }) {
    const instance = {
      element: options.element,
      lngLat: null as [number, number] | null,
      setLngLat(lngLat: [number, number]) {
        instance.lngLat = lngLat;
        return instance;
      },
      addTo() {
        return instance;
      },
      remove: vi.fn()
    };
    return instance;
  });
  const AttributionControlMock = vi.fn();
  // biome-ignore lint/style/useNamingConvention: maplibre-glの実APIに合わせクラス名(Map/Marker/AttributionControl)をPascalCaseのまま公開する
  return { default: { Map: MapMock, Marker: MarkerMock, AttributionControl: AttributionControlMock } };
});

const getMapInstance = () => vi.mocked(maplibregl.Map).mock.results[0].value;
/** テスト中に生成された全てのMarkerモックインスタンスを取得する */
const getMarkerInstances = () => vi.mocked(maplibregl.Marker).mock.results.map((result) => result.value);

/** mapInstance.onで登録された'click'ハンドラを取り出す */
const getClickHandler = (mapInstance: ReturnType<typeof getMapInstance>) => {
  const call = mapInstance.on.mock.calls.find(([event]: [string]) => event === 'click');
  return call?.[1];
};

const getSetDataMock = (sourceId: string) => setDataMocksBySourceId[sourceId];

describe('MapViewに関するテスト', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchCyclingActivities).mockResolvedValue([]);
    vi.mocked(syncCyclingActivities).mockResolvedValue({ success: true });
    vi.mocked(getBackfillStatus).mockResolvedValue(NOT_RUNNING_BACKFILL_STATUS);
  });

  test('マウントされたとき、コンテナ要素を指定して地図が生成される', () => {
    const { getByTestId } = renderWithChakra(
      <MapView layerVisibility={ALL_ON_VISIBILITY} {...DEFAULT_SELECTION_PROPS} />
    );

    const container = getByTestId('map-container');

    expect(maplibregl.Map).toHaveBeenCalledWith(expect.objectContaining({ container }));
  });

  test('アンマウントされたとき、地図のremoveが呼ばれる', () => {
    const { unmount } = renderWithChakra(<MapView layerVisibility={ALL_ON_VISIBILITY} {...DEFAULT_SELECTION_PROPS} />);
    const mapInstance = getMapInstance();

    unmount();

    expect(mapInstance.remove).toHaveBeenCalledTimes(1);
  });

  test('スタイルロード時、GSI航空写真のソースが追加される', () => {
    renderWithChakra(<MapView layerVisibility={ALL_ON_VISIBILITY} {...DEFAULT_SELECTION_PROPS} />);
    const mapInstance = getMapInstance();

    expect(mapInstance.addSource).toHaveBeenCalledWith(AERIAL_PHOTO_SOURCE_ID, {
      type: 'raster',
      tiles: [AERIAL_PHOTO_TILE_URL],
      tileSize: AERIAL_PHOTO_TILE_SIZE,
      attribution: AERIAL_PHOTO_ATTRIBUTION,
      maxzoom: expect.any(Number)
    });
  });

  test('スタイルロード時、GSI航空写真のレイヤーが道路カテゴリの最初のレイヤーより手前に追加される', () => {
    renderWithChakra(<MapView layerVisibility={ALL_ON_VISIBILITY} {...DEFAULT_SELECTION_PROPS} />);
    const mapInstance = getMapInstance();

    expect(mapInstance.addLayer).toHaveBeenCalledWith(
      { id: AERIAL_PHOTO_LAYER_ID, type: 'raster', source: AERIAL_PHOTO_SOURCE_ID },
      'road_motorway'
    );
  });

  test('スタイルロード時、ONのカテゴリに属するレイヤーはvisibility:visibleになる', () => {
    renderWithChakra(<MapView layerVisibility={ALL_ON_VISIBILITY} {...DEFAULT_SELECTION_PROPS} />);
    const mapInstance = getMapInstance();

    expect(mapInstance.setLayoutProperty).toHaveBeenCalledWith('road_motorway', 'visibility', 'visible');
    expect(mapInstance.setLayoutProperty).toHaveBeenCalledWith('building', 'visibility', 'visible');
    expect(mapInstance.setLayoutProperty).toHaveBeenCalledWith('poi_r1', 'visibility', 'visible');
    expect(mapInstance.setLayoutProperty).toHaveBeenCalledWith('label_city', 'visibility', 'visible');
  });

  test('スタイルロード時、OFFのカテゴリに属するレイヤーはvisibility:noneになる', () => {
    renderWithChakra(<MapView layerVisibility={ALL_ON_VISIBILITY} {...DEFAULT_SELECTION_PROPS} />);
    const mapInstance = getMapInstance();

    expect(mapInstance.setLayoutProperty).toHaveBeenCalledWith(AERIAL_PHOTO_LAYER_ID, 'visibility', 'none');
    expect(mapInstance.setLayoutProperty).toHaveBeenCalledWith(BICYCLE_LOG_LAYER_ID, 'visibility', 'none');
    expect(mapInstance.setLayoutProperty).toHaveBeenCalledWith(BICYCLE_LOG_SELECTED_LAYER_ID, 'visibility', 'none');
    expect(mapInstance.setLayoutProperty).toHaveBeenCalledWith(BICYCLE_LOG_FOCUSED_LAYER_ID, 'visibility', 'none');
  });

  test('layerVisibilityが変化したとき、該当レイヤーのvisibilityが更新される', () => {
    const { rerender } = renderWithChakra(<MapView layerVisibility={ALL_ON_VISIBILITY} {...DEFAULT_SELECTION_PROPS} />);
    const mapInstance = getMapInstance();
    mapInstance.setLayoutProperty.mockClear();

    rerender(<MapView layerVisibility={{ ...ALL_ON_VISIBILITY, 'osm-road': false }} {...DEFAULT_SELECTION_PROPS} />);

    expect(mapInstance.setLayoutProperty).toHaveBeenCalledWith('road_motorway', 'visibility', 'none');
    expect(mapInstance.setLayoutProperty).toHaveBeenCalledWith('road_minor', 'visibility', 'none');
  });

  test('スタイルロード時、自転車ログの通常・選択・フォーカス用の空のGeoJSONソース・ラインレイヤーが追加される', () => {
    renderWithChakra(<MapView layerVisibility={ALL_ON_VISIBILITY} {...DEFAULT_SELECTION_PROPS} />);
    const mapInstance = getMapInstance();
    const emptyData = { type: 'FeatureCollection', features: [] };

    expect(mapInstance.addSource).toHaveBeenCalledWith(BICYCLE_LOG_SOURCE_ID, { type: 'geojson', data: emptyData });
    expect(mapInstance.addSource).toHaveBeenCalledWith(BICYCLE_LOG_SELECTED_SOURCE_ID, {
      type: 'geojson',
      data: emptyData
    });
    expect(mapInstance.addSource).toHaveBeenCalledWith(BICYCLE_LOG_FOCUSED_SOURCE_ID, {
      type: 'geojson',
      data: emptyData
    });
    expect(mapInstance.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: BICYCLE_LOG_LAYER_ID,
        type: 'line',
        source: BICYCLE_LOG_SOURCE_ID,
        paint: expect.objectContaining({ 'line-color': BICYCLE_LOG_LINE_COLOR_DEFAULT })
      })
    );
    expect(mapInstance.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: BICYCLE_LOG_SELECTED_LAYER_ID,
        type: 'line',
        source: BICYCLE_LOG_SELECTED_SOURCE_ID,
        paint: expect.objectContaining({ 'line-color': BICYCLE_LOG_LINE_COLOR_SELECTED })
      })
    );
    expect(mapInstance.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: BICYCLE_LOG_FOCUSED_LAYER_ID,
        type: 'line',
        source: BICYCLE_LOG_FOCUSED_SOURCE_ID,
        paint: expect.objectContaining({ 'line-color': BICYCLE_LOG_LINE_COLOR_FOCUSED })
      })
    );
    // レイヤーが追加された順（通常→選択→フォーカス）で手前に描画される
    const layerIdCallOrder = mapInstance.addLayer.mock.calls.map(([layer]: [{ id: string }]) => layer.id);
    expect(layerIdCallOrder.indexOf(BICYCLE_LOG_LAYER_ID)).toBeLessThan(
      layerIdCallOrder.indexOf(BICYCLE_LOG_SELECTED_LAYER_ID)
    );
    expect(layerIdCallOrder.indexOf(BICYCLE_LOG_SELECTED_LAYER_ID)).toBeLessThan(
      layerIdCallOrder.indexOf(BICYCLE_LOG_FOCUSED_LAYER_ID)
    );
  });

  test('自転車ログレイヤーがOFF→ONに変化したとき、同期後に取得したデータが地図に反映される', async () => {
    vi.mocked(fetchCyclingActivities).mockResolvedValue([
      {
        id: '1',
        name: 'ライド1',
        distanceMeters: 1000,
        movingTimeSeconds: 600,
        elapsedTimeSeconds: 650,
        elevationGainMeters: 50,
        startDate: '2026-07-01T00:00:00Z',
        path: [
          [
            [139.7, 35.6],
            [139.8, 35.7]
          ]
        ]
      }
    ]);
    const { rerender } = renderWithChakra(<MapView layerVisibility={ALL_ON_VISIBILITY} {...DEFAULT_SELECTION_PROPS} />);

    rerender(<MapView layerVisibility={{ ...ALL_ON_VISIBILITY, 'bicycle-log': true }} {...DEFAULT_SELECTION_PROPS} />);

    await waitFor(() => {
      expect(syncCyclingActivities).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(fetchCyclingActivities).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(getSetDataMock(BICYCLE_LOG_SOURCE_ID)).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'FeatureCollection',
          features: [expect.objectContaining({ properties: { id: '1', name: 'ライド1' } })]
        })
      );
    });
  });

  test('filterで絞り込まれたアクティビティのみが、通常状態の自転車ログレイヤーに反映される', async () => {
    vi.mocked(fetchCyclingActivities).mockResolvedValue([
      {
        id: '1',
        name: '短距離ライド',
        distanceMeters: 1000,
        movingTimeSeconds: 600,
        elapsedTimeSeconds: 650,
        elevationGainMeters: 50,
        startDate: '2026-07-01T00:00:00Z',
        path: [
          [
            [139.7, 35.6],
            [139.8, 35.7]
          ]
        ]
      },
      {
        id: '2',
        name: '長距離ライド',
        distanceMeters: 50000,
        movingTimeSeconds: 7200,
        elapsedTimeSeconds: 7300,
        elevationGainMeters: 500,
        startDate: '2026-07-02T00:00:00Z',
        path: [
          [
            [139.7, 35.6],
            [139.9, 35.8]
          ]
        ]
      }
    ]);
    const { rerender } = renderWithChakra(
      <MapView
        layerVisibility={ALL_ON_VISIBILITY}
        {...DEFAULT_SELECTION_PROPS}
        filter={{ ...DEFAULT_ACTIVITY_FILTER, minDistanceKm: 10 }}
      />
    );

    rerender(
      <MapView
        layerVisibility={{ ...ALL_ON_VISIBILITY, 'bicycle-log': true }}
        {...DEFAULT_SELECTION_PROPS}
        filter={{ ...DEFAULT_ACTIVITY_FILTER, minDistanceKm: 10 }}
      />
    );

    await waitFor(() => {
      expect(getSetDataMock(BICYCLE_LOG_SOURCE_ID)).toHaveBeenCalledWith(
        expect.objectContaining({
          features: [expect.objectContaining({ properties: { id: '2', name: '長距離ライド' } })]
        })
      );
    });
  });

  test('自転車ログレイヤーがOFF→ONに変化したとき、同期に失敗した場合は参照APIを呼ばない', async () => {
    vi.mocked(syncCyclingActivities).mockResolvedValue({ success: false });
    const { rerender } = renderWithChakra(<MapView layerVisibility={ALL_ON_VISIBILITY} {...DEFAULT_SELECTION_PROPS} />);

    rerender(<MapView layerVisibility={{ ...ALL_ON_VISIBILITY, 'bicycle-log': true }} {...DEFAULT_SELECTION_PROPS} />);

    await waitFor(() => {
      expect(syncCyclingActivities).toHaveBeenCalledTimes(1);
    });
    expect(fetchCyclingActivities).not.toHaveBeenCalled();
  });

  test('自転車ログレイヤーがOFF→ONに変化したとき、初期取り込み実行中の場合は同期用APIを呼ばず取得済み分のみ表示する', async () => {
    vi.mocked(getBackfillStatus).mockResolvedValue({
      isRunning: true,
      totalCount: 4,
      completedCount: 1,
      progressPercent: 25,
      estimatedRemainingSeconds: 27,
      lastError: null
    });
    const { rerender } = renderWithChakra(<MapView layerVisibility={ALL_ON_VISIBILITY} {...DEFAULT_SELECTION_PROPS} />);

    rerender(<MapView layerVisibility={{ ...ALL_ON_VISIBILITY, 'bicycle-log': true }} {...DEFAULT_SELECTION_PROPS} />);

    await waitFor(() => {
      expect(fetchCyclingActivities).toHaveBeenCalledTimes(1);
    });
    expect(syncCyclingActivities).not.toHaveBeenCalled();
  });

  test('自転車ログレイヤーがON→OFFに変化したときは、同期用APIを呼ばない', () => {
    const { rerender } = renderWithChakra(
      <MapView layerVisibility={{ ...ALL_ON_VISIBILITY, 'bicycle-log': true }} {...DEFAULT_SELECTION_PROPS} />
    );
    vi.mocked(syncCyclingActivities).mockClear();

    rerender(<MapView layerVisibility={{ ...ALL_ON_VISIBILITY, 'bicycle-log': false }} {...DEFAULT_SELECTION_PROPS} />);

    expect(syncCyclingActivities).not.toHaveBeenCalled();
  });

  test('自転車ログレイヤーがOFF→ON→OFF→ONと変化した場合、ONになる度に同期用APIが呼ばれる', async () => {
    const { rerender } = renderWithChakra(<MapView layerVisibility={ALL_ON_VISIBILITY} {...DEFAULT_SELECTION_PROPS} />);

    rerender(<MapView layerVisibility={{ ...ALL_ON_VISIBILITY, 'bicycle-log': true }} {...DEFAULT_SELECTION_PROPS} />);
    await waitFor(() => {
      expect(syncCyclingActivities).toHaveBeenCalledTimes(1);
    });

    rerender(<MapView layerVisibility={{ ...ALL_ON_VISIBILITY, 'bicycle-log': false }} {...DEFAULT_SELECTION_PROPS} />);
    rerender(<MapView layerVisibility={{ ...ALL_ON_VISIBILITY, 'bicycle-log': true }} {...DEFAULT_SELECTION_PROPS} />);

    await waitFor(() => {
      expect(syncCyclingActivities).toHaveBeenCalledTimes(2);
    });
  });

  test('同期用APIの呼び出しが失敗した場合、グローバルなエラースタックに追加される', async () => {
    vi.mocked(syncCyclingActivities).mockRejectedValue(new Error('sync failed'));
    const { rerender } = renderWithChakra(
      <>
        <MapView layerVisibility={ALL_ON_VISIBILITY} {...DEFAULT_SELECTION_PROPS} />
        <ErrorsProbe />
      </>
    );

    rerender(
      <>
        <MapView layerVisibility={{ ...ALL_ON_VISIBILITY, 'bicycle-log': true }} {...DEFAULT_SELECTION_PROPS} />
        <ErrorsProbe />
      </>
    );

    await waitFor(() => {
      expect(screen.getByTestId('errors-probe').textContent).toContain('sync failed');
    });
    expect(fetchCyclingActivities).not.toHaveBeenCalled();
  });

  test('参照用APIの呼び出しが失敗した場合、グローバルなエラースタックに追加される', async () => {
    vi.mocked(fetchCyclingActivities).mockRejectedValue(new Error('fetch failed'));
    const { rerender } = renderWithChakra(
      <>
        <MapView layerVisibility={ALL_ON_VISIBILITY} {...DEFAULT_SELECTION_PROPS} />
        <ErrorsProbe />
      </>
    );

    rerender(
      <>
        <MapView layerVisibility={{ ...ALL_ON_VISIBILITY, 'bicycle-log': true }} {...DEFAULT_SELECTION_PROPS} />
        <ErrorsProbe />
      </>
    );

    await waitFor(() => {
      expect(screen.getByTestId('errors-probe').textContent).toContain('fetch failed');
    });
  });

  test('自転車ログレイヤーをクリックすると、クリック地点周辺で検出したアクティビティIDでonSelectActivitiesが呼ばれる', () => {
    const onSelectActivities = vi.fn();
    renderWithChakra(
      <MapView
        layerVisibility={ALL_ON_VISIBILITY}
        {...DEFAULT_SELECTION_PROPS}
        onSelectActivities={onSelectActivities}
      />
    );
    const mapInstance = getMapInstance();
    mapInstance.queryRenderedFeatures.mockReturnValue([{ properties: { id: '1' } }, { properties: { id: '2' } }]);
    const handleClick = getClickHandler(mapInstance);

    handleClick({ point: { x: 100, y: 200 } });

    expect(mapInstance.queryRenderedFeatures).toHaveBeenCalledWith(
      [
        [95, 195],
        [105, 205]
      ],
      { layers: [BICYCLE_LOG_LAYER_ID, BICYCLE_LOG_SELECTED_LAYER_ID, BICYCLE_LOG_FOCUSED_LAYER_ID] }
    );
    expect(onSelectActivities).toHaveBeenCalledWith(['1', '2']);
  });

  test('クリック地点周辺に自転車ログが無い場合、onSelectActivitiesは呼ばれない', () => {
    const onSelectActivities = vi.fn();
    renderWithChakra(
      <MapView
        layerVisibility={ALL_ON_VISIBILITY}
        {...DEFAULT_SELECTION_PROPS}
        onSelectActivities={onSelectActivities}
      />
    );
    const mapInstance = getMapInstance();
    mapInstance.queryRenderedFeatures.mockReturnValue([]);
    const handleClick = getClickHandler(mapInstance);

    handleClick({ point: { x: 100, y: 200 } });

    expect(onSelectActivities).not.toHaveBeenCalled();
  });

  test('同一クリックで同じアクティビティIDが複数検出された場合、重複を除いてonSelectActivitiesが呼ばれる', () => {
    const onSelectActivities = vi.fn();
    renderWithChakra(
      <MapView
        layerVisibility={ALL_ON_VISIBILITY}
        {...DEFAULT_SELECTION_PROPS}
        onSelectActivities={onSelectActivities}
      />
    );
    const mapInstance = getMapInstance();
    mapInstance.queryRenderedFeatures.mockReturnValue([{ properties: { id: '1' } }, { properties: { id: '1' } }]);
    const handleClick = getClickHandler(mapInstance);

    handleClick({ point: { x: 100, y: 200 } });

    expect(onSelectActivities).toHaveBeenCalledWith(['1']);
  });

  test('フォーカス中にクリックしても、ヒットテストが行われずonSelectActivitiesも呼ばれない', () => {
    const onSelectActivities = vi.fn();
    renderWithChakra(
      <MapView
        layerVisibility={ALL_ON_VISIBILITY}
        {...DEFAULT_SELECTION_PROPS}
        selectedIds={['1']}
        focusedId="1"
        onSelectActivities={onSelectActivities}
      />
    );
    const mapInstance = getMapInstance();
    mapInstance.queryRenderedFeatures.mockReturnValue([{ properties: { id: '2' } }]);
    const handleClick = getClickHandler(mapInstance);

    handleClick({ point: { x: 100, y: 200 } });

    expect(mapInstance.queryRenderedFeatures).not.toHaveBeenCalled();
    expect(onSelectActivities).not.toHaveBeenCalled();
  });

  test('selectedIds・focusedIdが変化すると、選択用レイヤーにフォーカス中を除いた選択中アクティビティが通し番号順で反映される', async () => {
    vi.mocked(fetchCyclingActivities).mockResolvedValue([
      {
        id: '1',
        name: 'ライド1',
        distanceMeters: 1000,
        movingTimeSeconds: 600,
        elapsedTimeSeconds: 650,
        elevationGainMeters: 50,
        startDate: '2026-07-01T00:00:00Z',
        path: [
          [
            [139.7, 35.6],
            [139.8, 35.7]
          ]
        ]
      },
      {
        id: '2',
        name: 'ライド2',
        distanceMeters: 2000,
        movingTimeSeconds: 1200,
        elapsedTimeSeconds: 1250,
        elevationGainMeters: 80,
        startDate: '2026-07-02T00:00:00Z',
        path: [
          [
            [139.7, 35.6],
            [139.9, 35.8]
          ]
        ]
      },
      {
        id: '3',
        name: 'ライド3',
        distanceMeters: 3000,
        movingTimeSeconds: 1800,
        elapsedTimeSeconds: 1850,
        elevationGainMeters: 100,
        startDate: '2026-07-03T00:00:00Z',
        path: [
          [
            [139.7, 35.6],
            [140.0, 35.9]
          ]
        ]
      }
    ]);
    const { rerender } = renderWithChakra(<MapView layerVisibility={ALL_ON_VISIBILITY} {...DEFAULT_SELECTION_PROPS} />);

    rerender(<MapView layerVisibility={{ ...ALL_ON_VISIBILITY, 'bicycle-log': true }} {...DEFAULT_SELECTION_PROPS} />);
    await waitFor(() => {
      expect(fetchCyclingActivities).toHaveBeenCalledTimes(1);
    });

    rerender(
      <MapView
        layerVisibility={{ ...ALL_ON_VISIBILITY, 'bicycle-log': true }}
        {...DEFAULT_SELECTION_PROPS}
        selectedIds={['2', '3']}
        focusedId="3"
      />
    );

    await waitFor(() => {
      expect(getSetDataMock(BICYCLE_LOG_FOCUSED_SOURCE_ID)).toHaveBeenCalledWith(
        expect.objectContaining({ features: [expect.objectContaining({ properties: { id: '3', name: 'ライド3' } })] })
      );
    });
    // 通し番号1番('2')のみが選択用レイヤーに残る（通し番号2番('3')はフォーカス用レイヤーへ）
    expect(getSetDataMock(BICYCLE_LOG_SELECTED_SOURCE_ID)).toHaveBeenCalledWith(
      expect.objectContaining({ features: [expect.objectContaining({ properties: { id: '2', name: 'ライド2' } })] })
    );
  });

  test('選択用レイヤーのfeatures配列は、通し番号の昇順（＝後からクリックしたものが配列末尾で最前面）で並ぶ', async () => {
    vi.mocked(fetchCyclingActivities).mockResolvedValue([
      {
        id: '1',
        name: 'ライド1',
        distanceMeters: 1000,
        movingTimeSeconds: 600,
        elapsedTimeSeconds: 650,
        elevationGainMeters: 50,
        startDate: '2026-07-01T00:00:00Z',
        path: [
          [
            [139.7, 35.6],
            [139.8, 35.7]
          ]
        ]
      },
      {
        id: '2',
        name: 'ライド2',
        distanceMeters: 2000,
        movingTimeSeconds: 1200,
        elapsedTimeSeconds: 1250,
        elevationGainMeters: 80,
        startDate: '2026-07-02T00:00:00Z',
        path: [
          [
            [139.7, 35.6],
            [139.9, 35.8]
          ]
        ]
      }
    ]);
    const { rerender } = renderWithChakra(<MapView layerVisibility={ALL_ON_VISIBILITY} {...DEFAULT_SELECTION_PROPS} />);
    rerender(<MapView layerVisibility={{ ...ALL_ON_VISIBILITY, 'bicycle-log': true }} {...DEFAULT_SELECTION_PROPS} />);
    await waitFor(() => {
      expect(fetchCyclingActivities).toHaveBeenCalledTimes(1);
    });

    // 通し番号0番が'2'、1番が'1'（クリック検出順が数値の昇順とは限らない例）
    rerender(
      <MapView
        layerVisibility={{ ...ALL_ON_VISIBILITY, 'bicycle-log': true }}
        {...DEFAULT_SELECTION_PROPS}
        selectedIds={['2', '1']}
        focusedId={null}
      />
    );

    await waitFor(() => {
      const calls = getSetDataMock(BICYCLE_LOG_SELECTED_SOURCE_ID).mock.calls;
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall.features.map((feature: { properties: { id: string } }) => feature.properties.id)).toEqual([
        '2',
        '1'
      ]);
    });
  });

  describe('スタート・ゴールマーカーに関するテスト', () => {
    const activityWithPath = {
      id: '1',
      name: 'ライド1',
      distanceMeters: 1000,
      movingTimeSeconds: 600,
      elapsedTimeSeconds: 650,
      elevationGainMeters: 50,
      startDate: '2026-07-01T00:00:00Z',
      path: [
        [
          [139.7, 35.6],
          [139.75, 35.65],
          [139.8, 35.7]
        ]
      ] as [number, number][][]
    };

    test('何もフォーカスされていない場合、マーカーは表示されない', async () => {
      vi.mocked(fetchCyclingActivities).mockResolvedValue([activityWithPath]);
      const { rerender } = renderWithChakra(
        <MapView layerVisibility={ALL_ON_VISIBILITY} {...DEFAULT_SELECTION_PROPS} />
      );

      rerender(
        <MapView layerVisibility={{ ...ALL_ON_VISIBILITY, 'bicycle-log': true }} {...DEFAULT_SELECTION_PROPS} />
      );

      await waitFor(() => expect(fetchCyclingActivities).toHaveBeenCalledTimes(1));
      expect(getMarkerInstances()).toHaveLength(0);
    });

    test('アクティビティをフォーカスすると、開始地点・終了地点にマーカーが表示される', async () => {
      vi.mocked(fetchCyclingActivities).mockResolvedValue([activityWithPath]);
      const { rerender } = renderWithChakra(
        <MapView layerVisibility={ALL_ON_VISIBILITY} {...DEFAULT_SELECTION_PROPS} />
      );
      rerender(
        <MapView layerVisibility={{ ...ALL_ON_VISIBILITY, 'bicycle-log': true }} {...DEFAULT_SELECTION_PROPS} />
      );
      await waitFor(() => expect(fetchCyclingActivities).toHaveBeenCalledTimes(1));

      rerender(
        <MapView
          layerVisibility={{ ...ALL_ON_VISIBILITY, 'bicycle-log': true }}
          {...DEFAULT_SELECTION_PROPS}
          selectedIds={['1']}
          focusedId="1"
        />
      );

      await waitFor(() => expect(getMarkerInstances()).toHaveLength(2));
      const lngLats = getMarkerInstances().map((marker) => marker.lngLat);
      expect(lngLats).toContainEqual([139.7, 35.6]);
      expect(lngLats).toContainEqual([139.8, 35.7]);
    });

    test('フォーカスを解除すると、マーカーが取り除かれる', async () => {
      vi.mocked(fetchCyclingActivities).mockResolvedValue([activityWithPath]);
      const { rerender } = renderWithChakra(
        <MapView layerVisibility={ALL_ON_VISIBILITY} {...DEFAULT_SELECTION_PROPS} />
      );
      rerender(
        <MapView
          layerVisibility={{ ...ALL_ON_VISIBILITY, 'bicycle-log': true }}
          {...DEFAULT_SELECTION_PROPS}
          selectedIds={['1']}
          focusedId="1"
        />
      );
      await waitFor(() => expect(getMarkerInstances()).toHaveLength(2));
      const previousMarkers = getMarkerInstances();

      rerender(
        <MapView layerVisibility={{ ...ALL_ON_VISIBILITY, 'bicycle-log': true }} {...DEFAULT_SELECTION_PROPS} />
      );

      await waitFor(() => {
        for (const marker of previousMarkers) {
          expect(marker.remove).toHaveBeenCalled();
        }
      });
    });

    test('軌跡(path)を持たないアクティビティをフォーカスしても、マーカーは表示されない', async () => {
      vi.mocked(fetchCyclingActivities).mockResolvedValue([{ ...activityWithPath, path: null }]);
      const { rerender } = renderWithChakra(
        <MapView layerVisibility={ALL_ON_VISIBILITY} {...DEFAULT_SELECTION_PROPS} />
      );
      rerender(
        <MapView layerVisibility={{ ...ALL_ON_VISIBILITY, 'bicycle-log': true }} {...DEFAULT_SELECTION_PROPS} />
      );
      await waitFor(() => expect(fetchCyclingActivities).toHaveBeenCalledTimes(1));

      rerender(
        <MapView
          layerVisibility={{ ...ALL_ON_VISIBILITY, 'bicycle-log': true }}
          {...DEFAULT_SELECTION_PROPS}
          selectedIds={['1']}
          focusedId="1"
        />
      );

      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(getMarkerInstances()).toHaveLength(0);
    });

    test('開始地点と終了地点が同じ座標の場合、スタートのマーカーが後に追加され手前に描画される', async () => {
      const roundTripActivity = {
        ...activityWithPath,
        path: [
          [
            [139.7, 35.6],
            [139.75, 35.65],
            [139.7, 35.6]
          ]
        ] as [number, number][][]
      };
      vi.mocked(fetchCyclingActivities).mockResolvedValue([roundTripActivity]);
      const { rerender } = renderWithChakra(
        <MapView layerVisibility={ALL_ON_VISIBILITY} {...DEFAULT_SELECTION_PROPS} />
      );
      rerender(
        <MapView layerVisibility={{ ...ALL_ON_VISIBILITY, 'bicycle-log': true }} {...DEFAULT_SELECTION_PROPS} />
      );
      await waitFor(() => expect(fetchCyclingActivities).toHaveBeenCalledTimes(1));

      rerender(
        <MapView
          layerVisibility={{ ...ALL_ON_VISIBILITY, 'bicycle-log': true }}
          {...DEFAULT_SELECTION_PROPS}
          selectedIds={['1']}
          focusedId="1"
        />
      );

      await waitFor(() => expect(getMarkerInstances()).toHaveLength(2));
      // 後から地図に追加された方（配列の末尾）がスタートのマーカーであり、DOM上で手前に描画される
      const lastMarker = getMarkerInstances()[getMarkerInstances().length - 1];
      expect(lastMarker.element.innerHTML).toEqual(createStartMarkerElement().innerHTML);
    });
  });
});
