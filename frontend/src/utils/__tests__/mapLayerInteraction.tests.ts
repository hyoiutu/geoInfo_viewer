import type maplibregl from 'maplibre-gl';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { CyclingActivity } from '../../api/activitiesApi';
import {
  BICYCLE_LOG_FOCUSED_LAYER_ID,
  BICYCLE_LOG_FOCUSED_SOURCE_ID,
  BICYCLE_LOG_LAYER_ID,
  BICYCLE_LOG_SELECTED_LAYER_ID,
  BICYCLE_LOG_SELECTED_SOURCE_ID
} from '../../constants/bicycleLog';
import type { CategorizedLayerIds, LayerVisibility } from '../../types/layer';
import {
  applyLayerVisibility,
  applySelectionLayers,
  applyStartGoalMarkers,
  registerBicycleLogClickHandler
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
});
