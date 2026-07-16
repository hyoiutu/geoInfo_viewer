import type { LayerSpecification } from 'maplibre-gl';
import { describe, expect, test } from 'vitest';
import { ADMIN_BOUNDARY_MUNICIPALITY_LAYER_ID } from '../../constants/adminBoundary';
import { AERIAL_PHOTO_LAYER_ID } from '../../constants/aerialPhoto';
import {
  BICYCLE_LOG_FOCUSED_LAYER_ID,
  BICYCLE_LOG_FOCUSED_OUTLINE_LAYER_ID,
  BICYCLE_LOG_LAYER_ID,
  BICYCLE_LOG_SELECTED_LAYER_ID
} from '../../constants/bicycleLog';
import type { CategorizedLayerIds } from '../../types/layer';
import { categorizeStyleLayer, groupLayerIdsByCategory, resolveStyleLayerIds } from '../mapLayerCategory';

const createLayer = (id: string, type: LayerSpecification['type'], sourceLayer?: string): LayerSpecification => {
  // categorizeStyleLayerはid・type・source-layerのみ参照するため、LayerSpecification（type別の
  // discriminated unionでpaint/layout等も要求されうる）を全て満たすテストダブルは用意せず必要最小限にする
  return {
    id,
    type,
    source: 'openmaptiles',
    ...(sourceLayer === undefined ? {} : { 'source-layer': sourceLayer })
  } as LayerSpecification;
};

describe('categorizeStyleLayerに関するテスト', () => {
  test('source-layerがbuildingのとき、osm-buildingを返す', () => {
    const layer = createLayer('building', 'fill', 'building');

    const category = categorizeStyleLayer(layer);

    expect(category).toBe('osm-building');
  });

  test('source-layerがpoiのとき、osm-poiを返す', () => {
    const layer = createLayer('poi_r1', 'symbol', 'poi');

    const category = categorizeStyleLayer(layer);

    expect(category).toBe('osm-poi');
  });

  test('idがairportのとき、osm-poiを返す', () => {
    const layer = createLayer('airport', 'symbol', 'aerodrome_label');

    const category = categorizeStyleLayer(layer);

    expect(category).toBe('osm-poi');
  });

  test('source-layerがtransportationのとき、osm-roadを返す', () => {
    const layer = createLayer('road_motorway', 'line', 'transportation');

    const category = categorizeStyleLayer(layer);

    expect(category).toBe('osm-road');
  });

  test('source-layerがtransportation_nameのとき、osm-roadを返す', () => {
    const layer = createLayer('highway-name-major', 'symbol', 'transportation_name');

    const category = categorizeStyleLayer(layer);

    expect(category).toBe('osm-road');
  });

  test('source-layerがaerowayのとき、osm-roadを返す', () => {
    const layer = createLayer('aeroway_runway', 'line', 'aeroway');

    const category = categorizeStyleLayer(layer);

    expect(category).toBe('osm-road');
  });

  test('idがboundary_3(source-layerはboundary)のとき、admin-boundaryを返す', () => {
    const layer = createLayer('boundary_3', 'line', 'boundary');

    const category = categorizeStyleLayer(layer);

    expect(category).toBe('admin-boundary');
  });

  test('source-layerがboundaryでもidがboundary_3以外(国境等)のとき、nullを返す（常時表示のベースレイヤー扱い）', () => {
    const layer = createLayer('boundary_2', 'line', 'boundary');

    const category = categorizeStyleLayer(layer);

    expect(category).toBeNull();
  });

  test.each([
    'label_state',
    'label_city',
    'label_city_capital',
    'label_town',
    'label_village'
  ])('idが%sの(都道府県・市町村名)のとき、admin-boundaryを返す', (id) => {
    const layer = createLayer(id, 'symbol', 'place');

    const category = categorizeStyleLayer(layer);

    expect(category).toBe('admin-boundary');
  });

  test.each([
    'label_country_1',
    'label_country_2',
    'label_country_3',
    'label_other'
  ])('idが%sの(都道府県・市町村名以外の地名)のとき、osm-place-nameを返す', (id) => {
    const layer = createLayer(id, 'symbol', 'place');

    const category = categorizeStyleLayer(layer);

    expect(category).toBe('osm-place-name');
  });

  test('source-layerがwater_nameのとき、osm-place-nameを返す', () => {
    const layer = createLayer('water_name_point_label', 'symbol', 'water_name');

    const category = categorizeStyleLayer(layer);

    expect(category).toBe('osm-place-name');
  });

  test('source-layerがwaterwayかつtypeがsymbolのとき、osm-place-nameを返す', () => {
    const layer = createLayer('waterway_line_label', 'symbol', 'waterway');

    const category = categorizeStyleLayer(layer);

    expect(category).toBe('osm-place-name');
  });

  test('source-layerがwaterwayかつtypeがlineのとき、nullを返す（常時表示のベースレイヤー扱い）', () => {
    const layer = createLayer('waterway_river', 'line', 'waterway');

    const category = categorizeStyleLayer(layer);

    expect(category).toBeNull();
  });

  test('どのカテゴリにも該当しないとき、nullを返す', () => {
    const layer = createLayer('landcover_wood', 'fill', 'landcover');

    const category = categorizeStyleLayer(layer);

    expect(category).toBeNull();
  });

  test('source-layerを持たないレイヤー（背景等）のとき、nullを返す', () => {
    const layer = createLayer('background', 'background');

    const category = categorizeStyleLayer(layer);

    expect(category).toBeNull();
  });
});

describe('groupLayerIdsByCategoryに関するテスト', () => {
  test('複数レイヤーをカテゴリごとに分類し、該当なしのレイヤーは含まれない', () => {
    const layers: LayerSpecification[] = [
      createLayer('background', 'background'),
      createLayer('landcover_wood', 'fill', 'landcover'),
      createLayer('road_motorway', 'line', 'transportation'),
      createLayer('road_minor', 'line', 'transportation'),
      createLayer('building', 'fill', 'building'),
      createLayer('poi_r1', 'symbol', 'poi'),
      createLayer('label_country_1', 'symbol', 'place'),
      createLayer('boundary_3', 'line', 'boundary'),
      createLayer('label_city', 'symbol', 'place')
    ];

    const grouped = groupLayerIdsByCategory(layers);

    expect(grouped).toEqual({
      'osm-poi': ['poi_r1'],
      'osm-road': ['road_motorway', 'road_minor'],
      'osm-building': ['building'],
      'osm-place-name': ['label_country_1'],
      'admin-boundary': ['boundary_3', 'label_city'],
      'aerial-photo': [],
      'bicycle-log': []
    });
  });

  test('空のレイヤー配列のとき、全カテゴリが空配列になる', () => {
    const grouped = groupLayerIdsByCategory([]);

    expect(grouped).toEqual({
      'osm-poi': [],
      'osm-road': [],
      'osm-building': [],
      'osm-place-name': [],
      'admin-boundary': [],
      'aerial-photo': [],
      'bicycle-log': []
    });
  });
});

describe('resolveStyleLayerIdsに関するテスト', () => {
  const SampleCategorizedLayerIds: CategorizedLayerIds = {
    'osm-poi': ['poi_r1'],
    'osm-road': ['road_motorway'],
    'osm-building': ['building'],
    'osm-place-name': ['label_country_1'],
    'admin-boundary': ['boundary_3', 'label_city'],
    'aerial-photo': [],
    'bicycle-log': []
  };

  test('aerial-photoのとき、専用のラスターレイヤーIDのみを返す', () => {
    const result = resolveStyleLayerIds('aerial-photo', SampleCategorizedLayerIds);

    expect(result).toEqual([AERIAL_PHOTO_LAYER_ID]);
  });

  test('bicycle-logのとき、通常・選択・フォーカスのハロー・フォーカス本体のレイヤーIDを返す', () => {
    const result = resolveStyleLayerIds('bicycle-log', SampleCategorizedLayerIds);

    expect(result).toEqual([
      BICYCLE_LOG_LAYER_ID,
      BICYCLE_LOG_SELECTED_LAYER_ID,
      BICYCLE_LOG_FOCUSED_OUTLINE_LAYER_ID,
      BICYCLE_LOG_FOCUSED_LAYER_ID
    ]);
  });

  test('admin-boundaryのとき、カテゴリ分類済みのレイヤーIDに加え市町村境界レイヤーIDを含める', () => {
    const result = resolveStyleLayerIds('admin-boundary', SampleCategorizedLayerIds);

    expect(result).toEqual(['boundary_3', 'label_city', ADMIN_BOUNDARY_MUNICIPALITY_LAYER_ID]);
  });

  test('それ以外のカテゴリのとき、カテゴリ分類済みのレイヤーIDをそのまま返す', () => {
    const result = resolveStyleLayerIds('osm-road', SampleCategorizedLayerIds);

    expect(result).toEqual(['road_motorway']);
  });
});
