import { waitFor } from '@testing-library/react';
import maplibregl from 'maplibre-gl';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fetchCyclingActivities, syncCyclingActivities } from '../../api/activitiesApi';
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
  syncCyclingActivities: vi.fn()
}));

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
  const MapMock = vi.fn().mockImplementation(function MockMap() {
    return { remove, once, getStyle, addSource, addLayer, setLayoutProperty, getSource };
  });
  // biome-ignore lint/style/useNamingConvention: maplibre-glの実APIに合わせクラス名(Map)をPascalCaseのまま公開する
  return { default: { Map: MapMock } };
});

const getMapInstance = () => vi.mocked(maplibregl.Map).mock.results[0].value;

describe('MapViewに関するテスト', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchCyclingActivities).mockResolvedValue([]);
    vi.mocked(syncCyclingActivities).mockResolvedValue({ success: true });
  });

  test('マウントされたとき、コンテナ要素を指定して地図が生成される', () => {
    const { getByTestId } = renderWithChakra(<MapView layerVisibility={ALL_ON_VISIBILITY} />);

    const container = getByTestId('map-container');

    expect(maplibregl.Map).toHaveBeenCalledWith(expect.objectContaining({ container }));
  });

  test('アンマウントされたとき、地図のremoveが呼ばれる', () => {
    const { unmount } = renderWithChakra(<MapView layerVisibility={ALL_ON_VISIBILITY} />);
    const mapInstance = getMapInstance();

    unmount();

    expect(mapInstance.remove).toHaveBeenCalledTimes(1);
  });

  test('スタイルロード時、GSI航空写真のソースが追加される', () => {
    renderWithChakra(<MapView layerVisibility={ALL_ON_VISIBILITY} />);
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
    renderWithChakra(<MapView layerVisibility={ALL_ON_VISIBILITY} />);
    const mapInstance = getMapInstance();

    expect(mapInstance.addLayer).toHaveBeenCalledWith(
      { id: AERIAL_PHOTO_LAYER_ID, type: 'raster', source: AERIAL_PHOTO_SOURCE_ID },
      'road_motorway'
    );
  });

  test('スタイルロード時、ONのカテゴリに属するレイヤーはvisibility:visibleになる', () => {
    renderWithChakra(<MapView layerVisibility={ALL_ON_VISIBILITY} />);
    const mapInstance = getMapInstance();

    expect(mapInstance.setLayoutProperty).toHaveBeenCalledWith('road_motorway', 'visibility', 'visible');
    expect(mapInstance.setLayoutProperty).toHaveBeenCalledWith('building', 'visibility', 'visible');
    expect(mapInstance.setLayoutProperty).toHaveBeenCalledWith('poi_r1', 'visibility', 'visible');
    expect(mapInstance.setLayoutProperty).toHaveBeenCalledWith('label_city', 'visibility', 'visible');
  });

  test('スタイルロード時、OFFのカテゴリに属するレイヤーはvisibility:noneになる', () => {
    renderWithChakra(<MapView layerVisibility={ALL_ON_VISIBILITY} />);
    const mapInstance = getMapInstance();

    expect(mapInstance.setLayoutProperty).toHaveBeenCalledWith(AERIAL_PHOTO_LAYER_ID, 'visibility', 'none');
    expect(mapInstance.setLayoutProperty).toHaveBeenCalledWith(BICYCLE_LOG_LAYER_ID, 'visibility', 'none');
  });

  test('layerVisibilityが変化したとき、該当レイヤーのvisibilityが更新される', () => {
    const { rerender } = renderWithChakra(<MapView layerVisibility={ALL_ON_VISIBILITY} />);
    const mapInstance = getMapInstance();
    mapInstance.setLayoutProperty.mockClear();

    rerender(<MapView layerVisibility={{ ...ALL_ON_VISIBILITY, 'osm-road': false }} />);

    expect(mapInstance.setLayoutProperty).toHaveBeenCalledWith('road_motorway', 'visibility', 'none');
    expect(mapInstance.setLayoutProperty).toHaveBeenCalledWith('road_minor', 'visibility', 'none');
  });

  test('スタイルロード時、自転車ログの空のGeoJSONソース・ラインレイヤーが追加される', () => {
    renderWithChakra(<MapView layerVisibility={ALL_ON_VISIBILITY} />);
    const mapInstance = getMapInstance();

    expect(mapInstance.addSource).toHaveBeenCalledWith(BICYCLE_LOG_SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });
    expect(mapInstance.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: BICYCLE_LOG_LAYER_ID, type: 'line', source: BICYCLE_LOG_SOURCE_ID })
    );
  });

  test('自転車ログレイヤーがOFF→ONに変化したとき、同期後に取得したデータが地図に反映される', async () => {
    vi.mocked(fetchCyclingActivities).mockResolvedValue([
      {
        id: 1,
        name: 'ライド1',
        distanceMeters: 1000,
        movingTimeSeconds: 600,
        startDate: '2026-07-01T00:00:00Z',
        path: [
          [139.7, 35.6],
          [139.8, 35.7]
        ]
      }
    ]);
    const { rerender } = renderWithChakra(<MapView layerVisibility={ALL_ON_VISIBILITY} />);
    const mapInstance = getMapInstance();

    rerender(<MapView layerVisibility={{ ...ALL_ON_VISIBILITY, 'bicycle-log': true }} />);

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
          features: [expect.objectContaining({ properties: { id: 1, name: 'ライド1' } })]
        })
      );
    });
  });

  test('自転車ログレイヤーがOFF→ONに変化したとき、同期に失敗した場合は参照APIを呼ばない', async () => {
    vi.mocked(syncCyclingActivities).mockResolvedValue({ success: false });
    const { rerender } = renderWithChakra(<MapView layerVisibility={ALL_ON_VISIBILITY} />);

    rerender(<MapView layerVisibility={{ ...ALL_ON_VISIBILITY, 'bicycle-log': true }} />);

    await waitFor(() => {
      expect(syncCyclingActivities).toHaveBeenCalledTimes(1);
    });
    expect(fetchCyclingActivities).not.toHaveBeenCalled();
  });

  test('自転車ログレイヤーがON→OFFに変化したときは、同期用APIを呼ばない', () => {
    const { rerender } = renderWithChakra(<MapView layerVisibility={{ ...ALL_ON_VISIBILITY, 'bicycle-log': true }} />);
    vi.mocked(syncCyclingActivities).mockClear();

    rerender(<MapView layerVisibility={{ ...ALL_ON_VISIBILITY, 'bicycle-log': false }} />);

    expect(syncCyclingActivities).not.toHaveBeenCalled();
  });

  test('自転車ログレイヤーがOFF→ON→OFF→ONと変化した場合、ONになる度に同期用APIが呼ばれる', async () => {
    const { rerender } = renderWithChakra(<MapView layerVisibility={ALL_ON_VISIBILITY} />);

    rerender(<MapView layerVisibility={{ ...ALL_ON_VISIBILITY, 'bicycle-log': true }} />);
    await waitFor(() => {
      expect(syncCyclingActivities).toHaveBeenCalledTimes(1);
    });

    rerender(<MapView layerVisibility={{ ...ALL_ON_VISIBILITY, 'bicycle-log': false }} />);
    rerender(<MapView layerVisibility={{ ...ALL_ON_VISIBILITY, 'bicycle-log': true }} />);

    await waitFor(() => {
      expect(syncCyclingActivities).toHaveBeenCalledTimes(2);
    });
  });
});
