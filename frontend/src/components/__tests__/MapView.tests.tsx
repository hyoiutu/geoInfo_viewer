import { waitFor } from '@testing-library/react';
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
import { BICYCLE_LOG_LAYER_ID, BICYCLE_LOG_SOURCE_ID } from '../../constants/bicycleLog';
import { renderWithChakra } from '../../test-utils/renderWithChakra';
import type { LayerVisibility } from '../../types/layer';
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
  onActivitiesLoaded: vi.fn()
};

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

describe('MapViewに関するテスト', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchCyclingActivities).mockResolvedValue([]);
    vi.mocked(syncCyclingActivities).mockResolvedValue({ success: true });
    vi.mocked(getBackfillStatus).mockResolvedValue(NOT_RUNNING_BACKFILL_STATUS);
  });

  test('マウントされたとき、コンテナ要素を指定して地図が生成される', () => {
    const { getByTestId } = renderWithChakra(
      <MapView layerVisibility={ALL_ON_VISIBILITY} onError={vi.fn()} {...DEFAULT_SELECTION_PROPS} />
    );

    const container = getByTestId('map-container');

    expect(maplibregl.Map).toHaveBeenCalledWith(expect.objectContaining({ container }));
  });

  test('アンマウントされたとき、地図のremoveが呼ばれる', () => {
    const { unmount } = renderWithChakra(
      <MapView layerVisibility={ALL_ON_VISIBILITY} onError={vi.fn()} {...DEFAULT_SELECTION_PROPS} />
    );
    const mapInstance = getMapInstance();

    unmount();

    expect(mapInstance.remove).toHaveBeenCalledTimes(1);
  });

  test('スタイルロード時、GSI航空写真のソースが追加される', () => {
    renderWithChakra(<MapView layerVisibility={ALL_ON_VISIBILITY} onError={vi.fn()} {...DEFAULT_SELECTION_PROPS} />);
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
    renderWithChakra(<MapView layerVisibility={ALL_ON_VISIBILITY} onError={vi.fn()} {...DEFAULT_SELECTION_PROPS} />);
    const mapInstance = getMapInstance();

    expect(mapInstance.addLayer).toHaveBeenCalledWith(
      { id: AERIAL_PHOTO_LAYER_ID, type: 'raster', source: AERIAL_PHOTO_SOURCE_ID },
      'road_motorway'
    );
  });

  test('スタイルロード時、ONのカテゴリに属するレイヤーはvisibility:visibleになる', () => {
    renderWithChakra(<MapView layerVisibility={ALL_ON_VISIBILITY} onError={vi.fn()} {...DEFAULT_SELECTION_PROPS} />);
    const mapInstance = getMapInstance();

    expect(mapInstance.setLayoutProperty).toHaveBeenCalledWith('road_motorway', 'visibility', 'visible');
    expect(mapInstance.setLayoutProperty).toHaveBeenCalledWith('building', 'visibility', 'visible');
    expect(mapInstance.setLayoutProperty).toHaveBeenCalledWith('poi_r1', 'visibility', 'visible');
    expect(mapInstance.setLayoutProperty).toHaveBeenCalledWith('label_city', 'visibility', 'visible');
  });

  test('スタイルロード時、OFFのカテゴリに属するレイヤーはvisibility:noneになる', () => {
    renderWithChakra(<MapView layerVisibility={ALL_ON_VISIBILITY} onError={vi.fn()} {...DEFAULT_SELECTION_PROPS} />);
    const mapInstance = getMapInstance();

    expect(mapInstance.setLayoutProperty).toHaveBeenCalledWith(AERIAL_PHOTO_LAYER_ID, 'visibility', 'none');
    expect(mapInstance.setLayoutProperty).toHaveBeenCalledWith(BICYCLE_LOG_LAYER_ID, 'visibility', 'none');
  });

  test('layerVisibilityが変化したとき、該当レイヤーのvisibilityが更新される', () => {
    const { rerender } = renderWithChakra(
      <MapView layerVisibility={ALL_ON_VISIBILITY} onError={vi.fn()} {...DEFAULT_SELECTION_PROPS} />
    );
    const mapInstance = getMapInstance();
    mapInstance.setLayoutProperty.mockClear();

    rerender(
      <MapView
        layerVisibility={{ ...ALL_ON_VISIBILITY, 'osm-road': false }}
        onError={vi.fn()}
        {...DEFAULT_SELECTION_PROPS}
      />
    );

    expect(mapInstance.setLayoutProperty).toHaveBeenCalledWith('road_motorway', 'visibility', 'none');
    expect(mapInstance.setLayoutProperty).toHaveBeenCalledWith('road_minor', 'visibility', 'none');
  });

  test('スタイルロード時、自転車ログの空のGeoJSONソース・ラインレイヤーが追加される', () => {
    renderWithChakra(<MapView layerVisibility={ALL_ON_VISIBILITY} onError={vi.fn()} {...DEFAULT_SELECTION_PROPS} />);
    const mapInstance = getMapInstance();

    expect(mapInstance.addSource).toHaveBeenCalledWith(BICYCLE_LOG_SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      promoteId: 'id'
    });
    expect(mapInstance.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: BICYCLE_LOG_LAYER_ID, type: 'line', source: BICYCLE_LOG_SOURCE_ID })
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
          [139.7, 35.6],
          [139.8, 35.7]
        ]
      }
    ]);
    const { rerender } = renderWithChakra(
      <MapView layerVisibility={ALL_ON_VISIBILITY} onError={vi.fn()} {...DEFAULT_SELECTION_PROPS} />
    );
    const mapInstance = getMapInstance();

    rerender(
      <MapView
        layerVisibility={{ ...ALL_ON_VISIBILITY, 'bicycle-log': true }}
        onError={vi.fn()}
        {...DEFAULT_SELECTION_PROPS}
      />
    );

    await waitFor(() => {
      expect(syncCyclingActivities).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(fetchCyclingActivities).toHaveBeenCalledTimes(1);
    });
    const source = mapInstance.getSource(BICYCLE_LOG_SOURCE_ID);
    await waitFor(() => {
      expect(source.setData).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'FeatureCollection',
          features: [expect.objectContaining({ properties: { id: '1', name: 'ライド1' } })]
        })
      );
    });
  });

  test('自転車ログレイヤーがOFF→ONに変化したとき、同期に失敗した場合は参照APIを呼ばない', async () => {
    vi.mocked(syncCyclingActivities).mockResolvedValue({ success: false });
    const { rerender } = renderWithChakra(
      <MapView layerVisibility={ALL_ON_VISIBILITY} onError={vi.fn()} {...DEFAULT_SELECTION_PROPS} />
    );

    rerender(
      <MapView
        layerVisibility={{ ...ALL_ON_VISIBILITY, 'bicycle-log': true }}
        onError={vi.fn()}
        {...DEFAULT_SELECTION_PROPS}
      />
    );

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
    const { rerender } = renderWithChakra(
      <MapView layerVisibility={ALL_ON_VISIBILITY} onError={vi.fn()} {...DEFAULT_SELECTION_PROPS} />
    );

    rerender(
      <MapView
        layerVisibility={{ ...ALL_ON_VISIBILITY, 'bicycle-log': true }}
        onError={vi.fn()}
        {...DEFAULT_SELECTION_PROPS}
      />
    );

    await waitFor(() => {
      expect(fetchCyclingActivities).toHaveBeenCalledTimes(1);
    });
    expect(syncCyclingActivities).not.toHaveBeenCalled();
  });

  test('自転車ログレイヤーがON→OFFに変化したときは、同期用APIを呼ばない', () => {
    const { rerender } = renderWithChakra(
      <MapView
        layerVisibility={{ ...ALL_ON_VISIBILITY, 'bicycle-log': true }}
        onError={vi.fn()}
        {...DEFAULT_SELECTION_PROPS}
      />
    );
    vi.mocked(syncCyclingActivities).mockClear();

    rerender(
      <MapView
        layerVisibility={{ ...ALL_ON_VISIBILITY, 'bicycle-log': false }}
        onError={vi.fn()}
        {...DEFAULT_SELECTION_PROPS}
      />
    );

    expect(syncCyclingActivities).not.toHaveBeenCalled();
  });

  test('自転車ログレイヤーがOFF→ON→OFF→ONと変化した場合、ONになる度に同期用APIが呼ばれる', async () => {
    const { rerender } = renderWithChakra(
      <MapView layerVisibility={ALL_ON_VISIBILITY} onError={vi.fn()} {...DEFAULT_SELECTION_PROPS} />
    );

    rerender(
      <MapView
        layerVisibility={{ ...ALL_ON_VISIBILITY, 'bicycle-log': true }}
        onError={vi.fn()}
        {...DEFAULT_SELECTION_PROPS}
      />
    );
    await waitFor(() => {
      expect(syncCyclingActivities).toHaveBeenCalledTimes(1);
    });

    rerender(
      <MapView
        layerVisibility={{ ...ALL_ON_VISIBILITY, 'bicycle-log': false }}
        onError={vi.fn()}
        {...DEFAULT_SELECTION_PROPS}
      />
    );
    rerender(
      <MapView
        layerVisibility={{ ...ALL_ON_VISIBILITY, 'bicycle-log': true }}
        onError={vi.fn()}
        {...DEFAULT_SELECTION_PROPS}
      />
    );

    await waitFor(() => {
      expect(syncCyclingActivities).toHaveBeenCalledTimes(2);
    });
  });

  test('同期用APIの呼び出しが失敗した場合、onErrorが呼ばれる', async () => {
    vi.mocked(syncCyclingActivities).mockRejectedValue(new Error('sync failed'));
    const onError = vi.fn();
    const { rerender } = renderWithChakra(
      <MapView layerVisibility={ALL_ON_VISIBILITY} onError={onError} {...DEFAULT_SELECTION_PROPS} />
    );

    rerender(
      <MapView
        layerVisibility={{ ...ALL_ON_VISIBILITY, 'bicycle-log': true }}
        onError={onError}
        {...DEFAULT_SELECTION_PROPS}
      />
    );

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'sync failed' }));
    });
    expect(fetchCyclingActivities).not.toHaveBeenCalled();
  });

  test('参照用APIの呼び出しが失敗した場合、onErrorが呼ばれる', async () => {
    vi.mocked(fetchCyclingActivities).mockRejectedValue(new Error('fetch failed'));
    const onError = vi.fn();
    const { rerender } = renderWithChakra(
      <MapView layerVisibility={ALL_ON_VISIBILITY} onError={onError} {...DEFAULT_SELECTION_PROPS} />
    );

    rerender(
      <MapView
        layerVisibility={{ ...ALL_ON_VISIBILITY, 'bicycle-log': true }}
        onError={onError}
        {...DEFAULT_SELECTION_PROPS}
      />
    );

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'fetch failed' }));
    });
  });

  test('自転車ログレイヤーをクリックすると、クリック地点周辺で検出したアクティビティIDでonSelectActivitiesが呼ばれる', () => {
    const onSelectActivities = vi.fn();
    renderWithChakra(
      <MapView
        layerVisibility={ALL_ON_VISIBILITY}
        onError={vi.fn()}
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
      { layers: [BICYCLE_LOG_LAYER_ID] }
    );
    expect(onSelectActivities).toHaveBeenCalledWith(['1', '2']);
  });

  test('クリック地点周辺に自転車ログが無い場合、onSelectActivitiesは呼ばれない', () => {
    const onSelectActivities = vi.fn();
    renderWithChakra(
      <MapView
        layerVisibility={ALL_ON_VISIBILITY}
        onError={vi.fn()}
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
        onError={vi.fn()}
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

  test('selectedIds・focusedIdが変化すると、取得済みの各アクティビティのfeature-stateが更新される', async () => {
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
          [139.7, 35.6],
          [139.8, 35.7]
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
          [139.7, 35.6],
          [139.9, 35.8]
        ]
      }
    ]);
    const { rerender } = renderWithChakra(
      <MapView layerVisibility={ALL_ON_VISIBILITY} onError={vi.fn()} {...DEFAULT_SELECTION_PROPS} />
    );
    const mapInstance = getMapInstance();

    rerender(
      <MapView
        layerVisibility={{ ...ALL_ON_VISIBILITY, 'bicycle-log': true }}
        onError={vi.fn()}
        {...DEFAULT_SELECTION_PROPS}
      />
    );
    await waitFor(() => {
      expect(fetchCyclingActivities).toHaveBeenCalledTimes(1);
    });
    mapInstance.setFeatureState.mockClear();

    rerender(
      <MapView
        layerVisibility={{ ...ALL_ON_VISIBILITY, 'bicycle-log': true }}
        onError={vi.fn()}
        {...DEFAULT_SELECTION_PROPS}
        selectedIds={['1']}
        focusedId="2"
      />
    );

    await waitFor(() => {
      expect(mapInstance.setFeatureState).toHaveBeenCalledWith(
        { source: BICYCLE_LOG_SOURCE_ID, id: '1' },
        { selected: true, focused: false }
      );
    });
    expect(mapInstance.setFeatureState).toHaveBeenCalledWith(
      { source: BICYCLE_LOG_SOURCE_ID, id: '2' },
      { selected: false, focused: true }
    );
  });
});
