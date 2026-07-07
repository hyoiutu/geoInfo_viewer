import maplibregl from 'maplibre-gl';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  AERIAL_PHOTO_ATTRIBUTION,
  AERIAL_PHOTO_LAYER_ID,
  AERIAL_PHOTO_SOURCE_ID,
  AERIAL_PHOTO_TILE_SIZE,
  AERIAL_PHOTO_TILE_URL
} from '../../constants/aerialPhoto';
import { renderWithChakra } from '../../test-utils/renderWithChakra';
import type { LayerVisibility } from '../../types/layer';
import { MapView } from '../MapView';

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
  'aerial-photo': false
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
  const MapMock = vi.fn().mockImplementation(function MockMap() {
    return { remove, once, getStyle, addSource, addLayer, setLayoutProperty };
  });
  // biome-ignore lint/style/useNamingConvention: maplibre-glの実APIに合わせクラス名(Map)をPascalCaseのまま公開する
  return { default: { Map: MapMock } };
});

const getMapInstance = () => vi.mocked(maplibregl.Map).mock.results[0].value;

describe('MapViewに関するテスト', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
  });

  test('layerVisibilityが変化したとき、該当レイヤーのvisibilityが更新される', () => {
    const { rerender } = renderWithChakra(<MapView layerVisibility={ALL_ON_VISIBILITY} />);
    const mapInstance = getMapInstance();
    mapInstance.setLayoutProperty.mockClear();

    rerender(<MapView layerVisibility={{ ...ALL_ON_VISIBILITY, 'osm-road': false }} />);

    expect(mapInstance.setLayoutProperty).toHaveBeenCalledWith('road_motorway', 'visibility', 'none');
    expect(mapInstance.setLayoutProperty).toHaveBeenCalledWith('road_minor', 'visibility', 'none');
  });
});
