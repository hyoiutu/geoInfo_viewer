import type maplibregl from 'maplibre-gl';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { CyclingActivity, PassedMunicipality } from '../../api/activitiesApi';
import {
  ADMIN_BOUNDARY_FOCUSED_SOURCE_ID,
  ADMIN_BOUNDARY_HISTORICAL_FILL_LAYER_ID,
  ADMIN_BOUNDARY_HISTORICAL_LABEL_LAYER_ID,
  ADMIN_BOUNDARY_HISTORICAL_LINE_LAYER_ID,
  ADMIN_BOUNDARY_HITTEST_FILL_LAYER_ID,
  ADMIN_BOUNDARY_MUNICIPALITY_LAYER_ID
} from '../../constants/adminBoundary';
import {
  BICYCLE_LOG_FOCUSED_LAYER_ID,
  BICYCLE_LOG_FOCUSED_SOURCE_ID,
  BICYCLE_LOG_LAYER_ID,
  BICYCLE_LOG_SELECTED_LAYER_ID,
  BICYCLE_LOG_SELECTED_SOURCE_ID
} from '../../constants/bicycleLog';
import type { CategorizedLayerIds, LayerVisibility } from '../../types/layer';
import {
  applyFocusedMunicipalityLayer,
  applyLayerVisibility,
  applySelectionLayers,
  applyStartGoalMarkers,
  panToMunicipalityCentroid,
  registerAdminBoundaryClickHandler,
  registerBicycleLogClickHandler,
  registerFocusedActivityHoverHandler
} from '../mapLayerInteraction';

const createActivity = (overrides: Partial<CyclingActivity>): CyclingActivity => ({
  id: '1',
  name: 'テストライド',
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
  ],
  ...overrides
});

describe('registerBicycleLogClickHandlerに関するテスト', () => {
  type ClickHandler = (event: { point: { x: number; y: number } }) => void;

  /** map.on/map.queryRenderedFeaturesのみを呼び出す最小限のMapLibre地図モック */
  const createMapMock = () => ({
    on: vi.fn<(event: string, handler: ClickHandler) => void>(),
    queryRenderedFeatures: vi.fn<() => { properties?: { id?: unknown } }[]>(() => [])
  });
  // テスト対象はmap.on/map.queryRenderedFeaturesのみ呼ぶため、必要最小限のモックへキャストする
  const asMap = (mock: ReturnType<typeof createMapMock>): maplibregl.Map => mock as never;

  const getClickHandler = (mock: ReturnType<typeof createMapMock>) => {
    const call = mock.on.mock.calls.find(([event]) => event === 'click');
    // mock.onの型はハンドラの型を保持しないため、呼び出し時の実引数の型へキャストする
    return call?.[1] as ClickHandler;
  };

  test('フォーカス中でない場合、クリック地点周辺で検出したアクティビティIDでonSelectActivitiesが呼ばれる', () => {
    const mapMock = createMapMock();
    mapMock.queryRenderedFeatures.mockReturnValue([{ properties: { id: '1' } }, { properties: { id: '2' } }]);
    const onSelectActivities = vi.fn();
    registerBicycleLogClickHandler(asMap(mapMock), onSelectActivities, () => false);

    getClickHandler(mapMock)({ point: { x: 100, y: 200 } });

    expect(mapMock.queryRenderedFeatures).toHaveBeenCalledWith(
      [
        [95, 195],
        [105, 205]
      ],
      { layers: [BICYCLE_LOG_LAYER_ID, BICYCLE_LOG_SELECTED_LAYER_ID, BICYCLE_LOG_FOCUSED_LAYER_ID] }
    );
    expect(onSelectActivities).toHaveBeenCalledWith(['1', '2']);
  });

  test('クリック地点周辺に自転車ログが無い場合、onSelectActivitiesは呼ばれない', () => {
    const mapMock = createMapMock();
    const onSelectActivities = vi.fn();
    registerBicycleLogClickHandler(asMap(mapMock), onSelectActivities, () => false);

    getClickHandler(mapMock)({ point: { x: 100, y: 200 } });

    expect(onSelectActivities).not.toHaveBeenCalled();
  });

  test('同一クリックで同じアクティビティIDが複数検出された場合、重複を除いてonSelectActivitiesが呼ばれる', () => {
    const mapMock = createMapMock();
    mapMock.queryRenderedFeatures.mockReturnValue([{ properties: { id: '1' } }, { properties: { id: '1' } }]);
    const onSelectActivities = vi.fn();
    registerBicycleLogClickHandler(asMap(mapMock), onSelectActivities, () => false);

    getClickHandler(mapMock)({ point: { x: 100, y: 200 } });

    expect(onSelectActivities).toHaveBeenCalledWith(['1']);
  });

  test('フォーカス中の場合、ヒットテストが行われずonSelectActivitiesも呼ばれない', () => {
    const mapMock = createMapMock();
    const onSelectActivities = vi.fn();
    registerBicycleLogClickHandler(asMap(mapMock), onSelectActivities, () => true);

    getClickHandler(mapMock)({ point: { x: 100, y: 200 } });

    expect(mapMock.queryRenderedFeatures).not.toHaveBeenCalled();
    expect(onSelectActivities).not.toHaveBeenCalled();
  });
});

describe('registerFocusedActivityHoverHandlerに関するテスト', () => {
  type MouseMoveHandler = (event: { point: { x: number; y: number }; lngLat: { lng: number; lat: number } }) => void;

  /** map.on/map.queryRenderedFeaturesのみを呼び出す最小限のMapLibre地図モック */
  const createMapMock = () => ({
    on: vi.fn<(event: string, handler: MouseMoveHandler) => void>(),
    queryRenderedFeatures: vi.fn<() => unknown[]>(() => [])
  });
  // テスト対象はmap.on/map.queryRenderedFeaturesのみ呼ぶため、必要最小限のモックへキャストする
  const asMap = (mock: ReturnType<typeof createMapMock>): maplibregl.Map => mock as never;

  const getMouseMoveHandler = (mock: ReturnType<typeof createMapMock>) => {
    const call = mock.on.mock.calls.find(([event]) => event === 'mousemove');
    // mock.onの型はハンドラの型を保持しないため、呼び出し時の実引数の型へキャストする
    return call?.[1] as MouseMoveHandler;
  };

  const activityWithPath = createActivity({
    path: [
      [
        [139.0, 35.0],
        [139.0, 35.01]
      ]
    ]
  });

  test('フォーカス中のアクティビティの線上をホバーすると、始点からの距離でonHoverが呼ばれる', () => {
    const mapMock = createMapMock();
    mapMock.queryRenderedFeatures.mockReturnValue([{ properties: { id: '1' } }]);
    const onHover = vi.fn();
    const onHoverEnd = vi.fn();
    registerFocusedActivityHoverHandler(asMap(mapMock), () => activityWithPath, onHover, onHoverEnd);

    getMouseMoveHandler(mapMock)({ point: { x: 100, y: 200 }, lngLat: { lng: 139.0, lat: 35.0 } });

    expect(mapMock.queryRenderedFeatures).toHaveBeenCalledWith(
      [
        [95, 195],
        [105, 205]
      ],
      { layers: [BICYCLE_LOG_FOCUSED_LAYER_ID] }
    );
    expect(onHover).toHaveBeenCalledWith([139.0, 35.0], expect.any(Number));
    expect(onHoverEnd).not.toHaveBeenCalled();
  });

  test('フォーカス中のアクティビティが無い場合、ヒットテストは行われずonHoverEndが呼ばれる', () => {
    const mapMock = createMapMock();
    const onHover = vi.fn();
    const onHoverEnd = vi.fn();
    registerFocusedActivityHoverHandler(asMap(mapMock), () => null, onHover, onHoverEnd);

    getMouseMoveHandler(mapMock)({ point: { x: 100, y: 200 }, lngLat: { lng: 139.0, lat: 35.0 } });

    expect(mapMock.queryRenderedFeatures).not.toHaveBeenCalled();
    expect(onHover).not.toHaveBeenCalled();
    expect(onHoverEnd).toHaveBeenCalledTimes(1);
  });

  test('軌跡(path)を持たないアクティビティがフォーカス中の場合、onHoverEndが呼ばれる', () => {
    const mapMock = createMapMock();
    const onHover = vi.fn();
    const onHoverEnd = vi.fn();
    registerFocusedActivityHoverHandler(asMap(mapMock), () => createActivity({ path: null }), onHover, onHoverEnd);

    getMouseMoveHandler(mapMock)({ point: { x: 100, y: 200 }, lngLat: { lng: 139.0, lat: 35.0 } });

    expect(onHover).not.toHaveBeenCalled();
    expect(onHoverEnd).toHaveBeenCalledTimes(1);
  });

  test('カーソル周辺にフォーカス中の線が無い場合、onHoverEndが呼ばれる', () => {
    const mapMock = createMapMock();
    mapMock.queryRenderedFeatures.mockReturnValue([]);
    const onHover = vi.fn();
    const onHoverEnd = vi.fn();
    registerFocusedActivityHoverHandler(asMap(mapMock), () => activityWithPath, onHover, onHoverEnd);

    getMouseMoveHandler(mapMock)({ point: { x: 100, y: 200 }, lngLat: { lng: 139.0, lat: 35.0 } });

    expect(onHover).not.toHaveBeenCalled();
    expect(onHoverEnd).toHaveBeenCalledTimes(1);
  });
});

describe('applySelectionLayersに関するテスト', () => {
  const createMapMock = () => {
    const selectedSetData = vi.fn();
    const focusedSetData = vi.fn();
    const getSource = vi.fn((sourceId: string) => {
      if (sourceId === BICYCLE_LOG_SELECTED_SOURCE_ID) {
        return { setData: selectedSetData };
      }
      if (sourceId === BICYCLE_LOG_FOCUSED_SOURCE_ID) {
        return { setData: focusedSetData };
      }
      return undefined;
    });
    return { getSource, selectedSetData, focusedSetData };
  };
  // テスト対象はmap.getSourceのみ呼ぶため、必要最小限のモックへキャストする
  const asMap = (mock: ReturnType<typeof createMapMock>): maplibregl.Map => mock as never;

  test('選択中アクティビティ（フォーカス中を除く）を選択用レイヤーのGeoJSONへ反映する', () => {
    const mapMock = createMapMock();
    const activity1 = createActivity({ id: '1' });
    const activity2 = createActivity({ id: '2' });

    applySelectionLayers(asMap(mapMock), [activity1, activity2], activity2);

    expect(mapMock.selectedSetData).toHaveBeenCalledWith(
      expect.objectContaining({
        features: [expect.objectContaining({ properties: { id: '1', name: 'テストライド' } })]
      })
    );
  });

  test('フォーカス中のアクティビティをフォーカス用レイヤーのGeoJSONへ反映する', () => {
    const mapMock = createMapMock();
    const activity = createActivity({ id: '1' });

    applySelectionLayers(asMap(mapMock), [activity], activity);

    expect(mapMock.focusedSetData).toHaveBeenCalledWith(
      expect.objectContaining({
        features: [expect.objectContaining({ properties: expect.objectContaining({ id: '1' }) })]
      })
    );
  });

  test('フォーカス中のアクティビティが無い場合、フォーカス用レイヤーは空になる', () => {
    const mapMock = createMapMock();

    applySelectionLayers(asMap(mapMock), [], null);

    expect(mapMock.focusedSetData).toHaveBeenCalledWith(expect.objectContaining({ features: [] }));
  });
});

describe('applyStartGoalMarkersに関するテスト', () => {
  test('フォーカス中のアクティビティが無い場合、既存のマーカーが取り除かれ新規追加は行われない', () => {
    const remove = vi.fn();
    const unmount = vi.fn();
    const markersRef = {
      // テスト対象はmarker.remove/root.unmountのみ呼ぶため、必要最小限のモックへキャストする
      current: [{ marker: { remove } as never, root: { unmount } as never }]
    };

    // フォーカス無しでは地図を一切操作しないため、実際のMapLibre地図インスタンスは不要
    applyStartGoalMarkers({} as maplibregl.Map, markersRef, null);

    expect(remove).toHaveBeenCalledTimes(1);
    expect(unmount).toHaveBeenCalledTimes(1);
    expect(markersRef.current).toEqual([]);
  });

  test('軌跡(path)を持たないアクティビティの場合、マーカーは追加されない', () => {
    const markersRef = { current: [] };

    // pathが無く早期リターンするため、実際のMapLibre地図インスタンスは不要
    applyStartGoalMarkers({} as maplibregl.Map, markersRef, createActivity({ path: null }));

    expect(markersRef.current).toEqual([]);
  });
});

describe('applyLayerVisibilityに関するテスト', () => {
  const createMapMock = () => ({ setLayoutProperty: vi.fn() });
  // テスト対象はmap.setLayoutPropertyのみ呼ぶため、必要最小限のモックへキャストする
  const asMap = (mock: ReturnType<typeof createMapMock>): maplibregl.Map => mock as never;

  const AllOnVisibility: LayerVisibility = {
    'osm-poi': true,
    'osm-road': true,
    'osm-building': true,
    'osm-place-name': true,
    'admin-boundary': true,
    'aerial-photo': false,
    'bicycle-log': false
  };
  const categorizedLayerIds: CategorizedLayerIds = {
    'osm-poi': ['poi_r1'],
    'osm-road': ['road_motorway'],
    'osm-building': [],
    'osm-place-name': [],
    'admin-boundary': [],
    'aerial-photo': [],
    'bicycle-log': []
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('ONのカテゴリに属するレイヤーはvisibility:visibleになる', () => {
    const mapMock = createMapMock();

    applyLayerVisibility(asMap(mapMock), categorizedLayerIds, AllOnVisibility, 'current');

    expect(mapMock.setLayoutProperty).toHaveBeenCalledWith('road_motorway', 'visibility', 'visible');
  });

  test('OFFのカテゴリに属するレイヤーはvisibility:noneになる', () => {
    const mapMock = createMapMock();

    applyLayerVisibility(asMap(mapMock), categorizedLayerIds, { ...AllOnVisibility, 'osm-poi': false }, 'current');

    expect(mapMock.setLayoutProperty).toHaveBeenCalledWith('poi_r1', 'visibility', 'none');
  });

  test('adminBoundaryEraがcurrentのとき、過去年代用のレイヤーが常に非表示になる', () => {
    const mapMock = createMapMock();

    applyLayerVisibility(asMap(mapMock), categorizedLayerIds, AllOnVisibility, 'current');

    expect(mapMock.setLayoutProperty).toHaveBeenCalledWith(
      ADMIN_BOUNDARY_HISTORICAL_FILL_LAYER_ID,
      'visibility',
      'none'
    );
    expect(mapMock.setLayoutProperty).toHaveBeenCalledWith(
      ADMIN_BOUNDARY_HISTORICAL_LINE_LAYER_ID,
      'visibility',
      'none'
    );
    expect(mapMock.setLayoutProperty).toHaveBeenCalledWith(
      ADMIN_BOUNDARY_HISTORICAL_LABEL_LAYER_ID,
      'visibility',
      'none'
    );
  });

  test('adminBoundaryEraが過去年代のとき、現行の行政区画レイヤーが常に非表示になる', () => {
    const mapMock = createMapMock();

    applyLayerVisibility(asMap(mapMock), categorizedLayerIds, AllOnVisibility, '2000-10-01');

    expect(mapMock.setLayoutProperty).toHaveBeenCalledWith(ADMIN_BOUNDARY_MUNICIPALITY_LAYER_ID, 'visibility', 'none');
  });
});

describe('registerAdminBoundaryClickHandlerに関するテスト', () => {
  type AdminBoundaryClickHandler = (event: { features?: { properties?: Record<string, unknown> }[] }) => void;

  /** map.onのみを呼び出す最小限のMapLibre地図モック */
  const createMapMock = () => ({
    on: vi.fn<(event: string, layerId: string, handler: AdminBoundaryClickHandler) => void>()
  });
  // テスト対象はmap.onのみ呼ぶため、必要最小限のモックへキャストする
  const asMap = (mock: ReturnType<typeof createMapMock>): maplibregl.Map => mock as never;

  const getClickHandler = (mock: ReturnType<typeof createMapMock>) => {
    const call = mock.on.mock.calls.find(
      ([event, layerId]) => event === 'click' && layerId === ADMIN_BOUNDARY_HITTEST_FILL_LAYER_ID
    );
    // mock.onの型はハンドラの型を保持しないため、呼び出し時の実引数の型へキャストする
    return call?.[2] as AdminBoundaryClickHandler;
  };

  test('hit-testレイヤーのクリックで検出したfeatureのprefectureName・municipalityNameでonFocusMunicipalityが呼ばれる', () => {
    const mapMock = createMapMock();
    const onFocusMunicipality = vi.fn();
    registerAdminBoundaryClickHandler(asMap(mapMock), onFocusMunicipality);

    getClickHandler(mapMock)({
      features: [{ properties: { prefectureName: '東京都', municipalityName: '渋谷区' } }]
    });

    expect(mapMock.on).toHaveBeenCalledWith('click', ADMIN_BOUNDARY_HITTEST_FILL_LAYER_ID, expect.any(Function));
    expect(onFocusMunicipality).toHaveBeenCalledWith({ prefectureName: '東京都', municipalityName: '渋谷区' });
  });

  test('検出したfeatureが無い場合、onFocusMunicipalityは呼ばれない', () => {
    const mapMock = createMapMock();
    const onFocusMunicipality = vi.fn();
    registerAdminBoundaryClickHandler(asMap(mapMock), onFocusMunicipality);

    getClickHandler(mapMock)({ features: [] });

    expect(onFocusMunicipality).not.toHaveBeenCalled();
  });

  test('featureのプロパティが不正な形式の場合、onFocusMunicipalityは呼ばれない', () => {
    const mapMock = createMapMock();
    const onFocusMunicipality = vi.fn();
    registerAdminBoundaryClickHandler(asMap(mapMock), onFocusMunicipality);

    getClickHandler(mapMock)({ features: [{ properties: { prefectureName: 123, municipalityName: '渋谷区' } }] });

    expect(onFocusMunicipality).not.toHaveBeenCalled();
  });
});

describe('applyFocusedMunicipalityLayerに関するテスト', () => {
  const createMapMock = () => {
    const setData = vi.fn();
    const getSource = vi.fn((sourceId: string) =>
      sourceId === ADMIN_BOUNDARY_FOCUSED_SOURCE_ID ? { setData } : undefined
    );
    return { getSource, setData };
  };
  // テスト対象はmap.getSourceのみ呼ぶため、必要最小限のモックへキャストする
  const asMap = (mock: ReturnType<typeof createMapMock>): maplibregl.Map => mock as never;

  const shibuya: GeoJSON.Feature = {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [139.7, 35.6] },
    properties: { prefectureName: '東京都', municipalityName: '渋谷区' }
  };
  const shinjuku: GeoJSON.Feature = {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [139.7, 35.7] },
    properties: { prefectureName: '東京都', municipalityName: '新宿区' }
  };
  const featureCollection: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [shibuya, shinjuku] };

  test('focusedMunicipalityに一致するfeatureをフォーカス用ソースへ反映し、そのfeatureを返す', () => {
    const mapMock = createMapMock();
    const focusedMunicipality: PassedMunicipality = { prefectureName: '東京都', municipalityName: '渋谷区' };

    const result = applyFocusedMunicipalityLayer(asMap(mapMock), featureCollection, focusedMunicipality);

    expect(mapMock.setData).toHaveBeenCalledWith({ type: 'FeatureCollection', features: [shibuya] });
    expect(result).toBe(shibuya);
  });

  test('focusedMunicipalityがnullの場合、フォーカス用ソースを空にしundefinedを返す', () => {
    const mapMock = createMapMock();

    const result = applyFocusedMunicipalityLayer(asMap(mapMock), featureCollection, null);

    expect(mapMock.setData).toHaveBeenCalledWith({ type: 'FeatureCollection', features: [] });
    expect(result).toBeUndefined();
  });

  test('focusedMunicipalityに一致するfeatureが無い場合、フォーカス用ソースを空にしundefinedを返す', () => {
    const mapMock = createMapMock();
    const focusedMunicipality: PassedMunicipality = { prefectureName: '大阪府', municipalityName: '中央区' };

    const result = applyFocusedMunicipalityLayer(asMap(mapMock), featureCollection, focusedMunicipality);

    expect(mapMock.setData).toHaveBeenCalledWith({ type: 'FeatureCollection', features: [] });
    expect(result).toBeUndefined();
  });
});

describe('panToMunicipalityCentroidに関するテスト', () => {
  const createMapMock = () => ({ panTo: vi.fn() });
  // テスト対象はmap.panToのみ呼ぶため、必要最小限のモックへキャストする
  const asMap = (mock: ReturnType<typeof createMapMock>): maplibregl.Map => mock as never;

  test('Polygon/MultiPolygonのfeatureの場合、重心へpanToする', () => {
    const mapMock = createMapMock();
    const feature: GeoJSON.Feature = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [2, 0],
            [2, 2],
            [0, 2],
            [0, 0]
          ]
        ]
      },
      properties: {}
    };

    panToMunicipalityCentroid(asMap(mapMock), feature);

    expect(mapMock.panTo).toHaveBeenCalledTimes(1);
    const [center] = mapMock.panTo.mock.calls[0];
    expect(center[0]).toBeCloseTo(1, 6);
    expect(center[1]).toBeCloseTo(1, 6);
  });

  test('Polygon/MultiPolygon以外のジオメトリの場合、panToは呼ばれない', () => {
    const mapMock = createMapMock();
    const feature: GeoJSON.Feature = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [139.7, 35.6] },
      properties: {}
    };

    panToMunicipalityCentroid(asMap(mapMock), feature);

    expect(mapMock.panTo).not.toHaveBeenCalled();
  });
});
