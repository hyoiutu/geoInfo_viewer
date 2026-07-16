import type maplibregl from 'maplibre-gl';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  ADMIN_BOUNDARY_HISTORICAL_FILL_LAYER_ID,
  ADMIN_BOUNDARY_HISTORICAL_LABEL_LAYER_ID,
  ADMIN_BOUNDARY_HISTORICAL_LINE_LAYER_ID,
  ADMIN_BOUNDARY_HISTORICAL_SOURCE_ID,
  ADMIN_BOUNDARY_MUNICIPALITY_FILTER,
  ADMIN_BOUNDARY_MUNICIPALITY_LAYER_ID,
  ADMIN_BOUNDARY_MUNICIPALITY_LINE_COLOR,
  ADMIN_BOUNDARY_MUNICIPALITY_LINE_DASHARRAY,
  ADMIN_BOUNDARY_MUNICIPALITY_MIN_ZOOM,
  ADMIN_BOUNDARY_MUNICIPALITY_SOURCE_ID,
  ADMIN_BOUNDARY_MUNICIPALITY_SOURCE_LAYER
} from '../../constants/adminBoundary';
import {
  AERIAL_PHOTO_ATTRIBUTION,
  AERIAL_PHOTO_LAYER_ID,
  AERIAL_PHOTO_SOURCE_ID,
  AERIAL_PHOTO_TILE_SIZE,
  AERIAL_PHOTO_TILE_URL
} from '../../constants/aerialPhoto';
import {
  BICYCLE_LOG_FOCUSED_LAYER_ID,
  BICYCLE_LOG_FOCUSED_OUTLINE_COLOR,
  BICYCLE_LOG_FOCUSED_OUTLINE_LAYER_ID,
  BICYCLE_LOG_FOCUSED_OUTLINE_WIDTH,
  BICYCLE_LOG_FOCUSED_SOURCE_ID,
  BICYCLE_LOG_LAYER_ID,
  BICYCLE_LOG_LINE_COLOR_DEFAULT,
  BICYCLE_LOG_LINE_COLOR_FOCUSED,
  BICYCLE_LOG_LINE_COLOR_SELECTED,
  BICYCLE_LOG_LINE_WIDTH_DEFAULT,
  BICYCLE_LOG_LINE_WIDTH_FOCUSED,
  BICYCLE_LOG_LINE_WIDTH_SELECTED,
  BICYCLE_LOG_SELECTED_LAYER_ID,
  BICYCLE_LOG_SELECTED_SOURCE_ID,
  BICYCLE_LOG_SOURCE_ID
} from '../../constants/bicycleLog';
import type { CategorizedLayerIds } from '../../types/layer';
import type { MunicipalityEra } from '../../types/municipalityEra';
import {
  addAdminBoundaryHistoricalLayer,
  addAdminBoundaryLayer,
  addAerialPhotoLayer,
  addBicycleLogLayer,
  applyAdminBoundaryHistoricalData
} from '../mapLayerSetup';

vi.mock('../../api/municipalitiesApi', () => ({
  fetchMunicipalityBoundaries: vi.fn()
}));

/** map.addSource/map.addLayer/map.getSourceのみを呼び出す最小限のMapLibre地図モック */
const createMapMock = () => ({
  addSource: vi.fn(),
  addLayer: vi.fn<(layer: { id: string }, beforeId?: string) => void>(),
  getSource: vi.fn()
});

/**
 * テスト対象の各関数はmap.addSource/map.addLayer/map.getSourceのみを呼ぶため、maplibregl.Mapの全プロパティを
 * 満たすテストダブルは用意せず、必要最小限のモックをテスト対象の引数として渡せるようにキャストする
 */
const asMap = (mock: ReturnType<typeof createMapMock>): maplibregl.Map => mock as never;

const EMPTY_CATEGORIZED_LAYER_IDS: CategorizedLayerIds = {
  'osm-poi': [],
  'osm-road': ['road_motorway', 'road_minor'],
  'osm-building': [],
  'osm-place-name': [],
  'admin-boundary': [],
  'aerial-photo': [],
  'bicycle-log': []
};

describe('addAerialPhotoLayerに関するテスト', () => {
  test('航空写真のラスタータイルソースを追加する', () => {
    const map = createMapMock();

    addAerialPhotoLayer(asMap(map), EMPTY_CATEGORIZED_LAYER_IDS);

    expect(map.addSource).toHaveBeenCalledWith(AERIAL_PHOTO_SOURCE_ID, {
      type: 'raster',
      tiles: [AERIAL_PHOTO_TILE_URL],
      tileSize: AERIAL_PHOTO_TILE_SIZE,
      attribution: AERIAL_PHOTO_ATTRIBUTION,
      maxzoom: expect.any(Number)
    });
  });

  test('道路カテゴリの最初のレイヤーより手前にラスターレイヤーを追加する', () => {
    const map = createMapMock();

    addAerialPhotoLayer(asMap(map), EMPTY_CATEGORIZED_LAYER_IDS);

    expect(map.addLayer).toHaveBeenCalledWith(
      { id: AERIAL_PHOTO_LAYER_ID, type: 'raster', source: AERIAL_PHOTO_SOURCE_ID },
      'road_motorway'
    );
  });
});

describe('addAdminBoundaryLayerに関するテスト', () => {
  test('市町村行政区画の境界線レイヤーを、都道府県境界(boundary_3)の手前にadmin_level 7〜8のフィルタで追加する', () => {
    const map = createMapMock();

    addAdminBoundaryLayer(asMap(map));

    expect(map.addLayer).toHaveBeenCalledWith(
      {
        id: ADMIN_BOUNDARY_MUNICIPALITY_LAYER_ID,
        type: 'line',
        source: ADMIN_BOUNDARY_MUNICIPALITY_SOURCE_ID,
        'source-layer': ADMIN_BOUNDARY_MUNICIPALITY_SOURCE_LAYER,
        filter: ADMIN_BOUNDARY_MUNICIPALITY_FILTER,
        minzoom: ADMIN_BOUNDARY_MUNICIPALITY_MIN_ZOOM,
        paint: {
          'line-color': ADMIN_BOUNDARY_MUNICIPALITY_LINE_COLOR,
          'line-dasharray': ADMIN_BOUNDARY_MUNICIPALITY_LINE_DASHARRAY
        }
      },
      'boundary_3'
    );
  });
});

describe('addBicycleLogLayerに関するテスト', () => {
  test('通常・選択・フォーカス用の空のGeoJSONソースを追加する', () => {
    const map = createMapMock();
    const emptyData = { type: 'FeatureCollection', features: [] };

    addBicycleLogLayer(asMap(map));

    expect(map.addSource).toHaveBeenCalledWith(BICYCLE_LOG_SOURCE_ID, { type: 'geojson', data: emptyData });
    expect(map.addSource).toHaveBeenCalledWith(BICYCLE_LOG_SELECTED_SOURCE_ID, { type: 'geojson', data: emptyData });
    expect(map.addSource).toHaveBeenCalledWith(BICYCLE_LOG_FOCUSED_SOURCE_ID, { type: 'geojson', data: emptyData });
  });

  test('通常・選択・フォーカスのハロー・フォーカス本体の順でラインレイヤーを追加する（後から追加した方が手前）', () => {
    const map = createMapMock();

    addBicycleLogLayer(asMap(map));

    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: BICYCLE_LOG_LAYER_ID,
        type: 'line',
        source: BICYCLE_LOG_SOURCE_ID,
        paint: { 'line-color': BICYCLE_LOG_LINE_COLOR_DEFAULT, 'line-width': BICYCLE_LOG_LINE_WIDTH_DEFAULT }
      })
    );
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: BICYCLE_LOG_SELECTED_LAYER_ID,
        type: 'line',
        source: BICYCLE_LOG_SELECTED_SOURCE_ID,
        paint: { 'line-color': BICYCLE_LOG_LINE_COLOR_SELECTED, 'line-width': BICYCLE_LOG_LINE_WIDTH_SELECTED }
      })
    );
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: BICYCLE_LOG_FOCUSED_OUTLINE_LAYER_ID,
        type: 'line',
        source: BICYCLE_LOG_FOCUSED_SOURCE_ID,
        paint: { 'line-color': BICYCLE_LOG_FOCUSED_OUTLINE_COLOR, 'line-width': BICYCLE_LOG_FOCUSED_OUTLINE_WIDTH }
      })
    );
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: BICYCLE_LOG_FOCUSED_LAYER_ID,
        type: 'line',
        source: BICYCLE_LOG_FOCUSED_SOURCE_ID,
        paint: { 'line-color': BICYCLE_LOG_LINE_COLOR_FOCUSED, 'line-width': BICYCLE_LOG_LINE_WIDTH_FOCUSED }
      })
    );

    const layerIdCallOrder = map.addLayer.mock.calls.map(([layer]) => layer.id);
    expect(layerIdCallOrder).toEqual([
      BICYCLE_LOG_LAYER_ID,
      BICYCLE_LOG_SELECTED_LAYER_ID,
      BICYCLE_LOG_FOCUSED_OUTLINE_LAYER_ID,
      BICYCLE_LOG_FOCUSED_LAYER_ID
    ]);
  });
});

describe('addAdminBoundaryHistoricalLayerに関するテスト', () => {
  test('空のGeoJSONソースを追加する', () => {
    const map = createMapMock();

    addAdminBoundaryHistoricalLayer(asMap(map));

    expect(map.addSource).toHaveBeenCalledWith(ADMIN_BOUNDARY_HISTORICAL_SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });
  });

  test('塗り・線・ラベルの3レイヤーを同じソースを参照して追加する', () => {
    const map = createMapMock();

    addAdminBoundaryHistoricalLayer(asMap(map));

    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: ADMIN_BOUNDARY_HISTORICAL_FILL_LAYER_ID,
        type: 'fill',
        source: ADMIN_BOUNDARY_HISTORICAL_SOURCE_ID,
        minzoom: ADMIN_BOUNDARY_MUNICIPALITY_MIN_ZOOM
      })
    );
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: ADMIN_BOUNDARY_HISTORICAL_LINE_LAYER_ID,
        type: 'line',
        source: ADMIN_BOUNDARY_HISTORICAL_SOURCE_ID,
        minzoom: ADMIN_BOUNDARY_MUNICIPALITY_MIN_ZOOM
      })
    );
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: ADMIN_BOUNDARY_HISTORICAL_LABEL_LAYER_ID,
        type: 'symbol',
        source: ADMIN_BOUNDARY_HISTORICAL_SOURCE_ID,
        minzoom: ADMIN_BOUNDARY_MUNICIPALITY_MIN_ZOOM
      })
    );
  });
});

describe('applyAdminBoundaryHistoricalDataに関するテスト', () => {
  let setData: ReturnType<typeof vi.fn>;
  let fetchMunicipalityBoundaries: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    setData = vi.fn();
    fetchMunicipalityBoundaries = vi.mocked((await import('../../api/municipalitiesApi')).fetchMunicipalityBoundaries);
    fetchMunicipalityBoundaries.mockReset();
  });

  test('eraがcurrentの場合、何もしない（取得もsetDataも行わない）', async () => {
    const mapMock = createMapMock();
    mapMock.getSource.mockReturnValue({ setData });
    const map = asMap(mapMock);
    const cache = new Map<MunicipalityEra, GeoJSON.FeatureCollection>();

    await applyAdminBoundaryHistoricalData(map, 'current', cache);

    expect(fetchMunicipalityBoundaries).not.toHaveBeenCalled();
    expect(setData).not.toHaveBeenCalled();
  });

  test('eraがcurrent以外かつキャッシュが無い場合、取得しキャッシュへ保存した上でsetDataへ渡す', async () => {
    const featureCollection = { type: 'FeatureCollection' as const, features: [] };
    fetchMunicipalityBoundaries.mockResolvedValue(featureCollection);
    const mapMock = createMapMock();
    mapMock.getSource.mockReturnValue({ setData });
    const map = asMap(mapMock);
    const cache = new Map<MunicipalityEra, GeoJSON.FeatureCollection>();

    await applyAdminBoundaryHistoricalData(map, '2000-10-01', cache);

    expect(fetchMunicipalityBoundaries).toHaveBeenCalledWith('2000-10-01');
    expect(setData).toHaveBeenCalledWith(featureCollection);
    expect(cache.get('2000-10-01')).toBe(featureCollection);
  });

  test('キャッシュに既に該当年代のデータがある場合、再取得せずキャッシュの内容をsetDataへ渡す', async () => {
    const cachedFeatureCollection = { type: 'FeatureCollection' as const, features: [] };
    const mapMock = createMapMock();
    mapMock.getSource.mockReturnValue({ setData });
    const map = asMap(mapMock);
    const cache = new Map<MunicipalityEra, GeoJSON.FeatureCollection>([['2000-10-01', cachedFeatureCollection]]);

    await applyAdminBoundaryHistoricalData(map, '2000-10-01', cache);

    expect(fetchMunicipalityBoundaries).not.toHaveBeenCalled();
    expect(setData).toHaveBeenCalledWith(cachedFeatureCollection);
  });
});
