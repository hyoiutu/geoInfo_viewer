import { waitFor } from '@testing-library/react';
import maplibregl from 'maplibre-gl';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { CyclingActivity, PassedMunicipality } from '../../api/activitiesApi';
import { fetchMunicipalityBoundaries } from '../../api/municipalitiesApi';
import {
  ADMIN_BOUNDARY_FOCUSED_SOURCE_ID,
  ADMIN_BOUNDARY_HITTEST_FILL_LAYER_ID,
  ADMIN_BOUNDARY_HITTEST_SOURCE_ID,
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
import { renderWithChakra } from '../../test-utils/renderWithChakra';
import type { LayerVisibility } from '../../types/layer';
import { createStartMarkerElement } from '../../utils/startGoalMarkerElement';
import { MapView } from '../MapView';

vi.mock('../../api/municipalitiesApi', () => ({
  fetchMunicipalityBoundaries: vi.fn()
}));

const FIXTURE_STYLE_LAYERS = [
  { id: 'background', type: 'background' },
  { id: 'landcover_wood', type: 'fill', 'source-layer': 'landcover' },
  { id: 'road_motorway', type: 'line', 'source-layer': 'transportation' },
  { id: 'road_minor', type: 'line', 'source-layer': 'transportation' },
  { id: 'building', type: 'fill', 'source-layer': 'building' },
  { id: 'poi_r1', type: 'symbol', 'source-layer': 'poi' },
  { id: 'label_country_1', type: 'symbol', 'source-layer': 'place' },
  { id: 'boundary_3', type: 'line', 'source-layer': 'boundary' },
  { id: 'label_city', type: 'symbol', 'source-layer': 'place' }
];

const ALL_ON_VISIBILITY: LayerVisibility = {
  'osm-poi': true,
  'osm-road': true,
  'osm-building': true,
  'osm-place-name': true,
  'admin-boundary': true,
  'aerial-photo': false,
  'bicycle-log': false
};

const DEFAULT_SELECTED_ACTIVITIES: CyclingActivity[] = [];
const DEFAULT_FOCUSED_ACTIVITY: CyclingActivity | null = null;
const DEFAULT_FILTERED_ACTIVITIES: CyclingActivity[] = [];

const DEFAULT_FOCUSED_MUNICIPALITY: PassedMunicipality | null = null;

const DEFAULT_SELECTION_PROPS = {
  selectedActivities: DEFAULT_SELECTED_ACTIVITIES,
  focusedActivity: DEFAULT_FOCUSED_ACTIVITY,
  onSelectActivities: vi.fn(),
  filteredActivities: DEFAULT_FILTERED_ACTIVITIES,
  adminBoundaryEra: 'current' as const,
  focusedMunicipality: DEFAULT_FOCUSED_MUNICIPALITY,
  onFocusMunicipality: vi.fn()
};

const createActivity = (overrides: Partial<CyclingActivity>): CyclingActivity => ({
  id: '1',
  name: 'テストライド',
  distanceMeters: 1000,
  movingTimeSeconds: 600,
  elapsedTimeSeconds: 650,
  elevationGainMeters: 50,
  startDate: '2026-07-01T00:00:00Z',
  path: null,
  ...overrides
});

// ソースIDごとに独立したsetDataスパイを返す（BICYCLE_LOG_SOURCE_ID等、複数ソースを区別して検証するため）
const setDataMocksBySourceId: Record<string, ReturnType<typeof vi.fn>> = {};

/** maplibregl.Markerモックのインスタンス形状 */
type MarkerMockInstance = {
  /** Markerに渡されたDOM要素 */
  element: HTMLElement;
  /** setLngLatで設定された座標 */
  lngLat: [number, number] | null;
  /** 座標を設定するモックメソッド */
  setLngLat: (lngLat: [number, number]) => MarkerMockInstance;
  /** 地図へ追加するモックメソッド */
  addTo: () => MarkerMockInstance;
  /** Markerを取り除くモックメソッド */
  remove: ReturnType<typeof vi.fn>;
};

/** maplibregl.Popupモックのインスタンス形状 */
type PopupMockInstance = {
  /** setLngLatで設定された座標 */
  lngLat: [number, number] | null;
  /** setTextで設定されたテキスト */
  text: string | null;
  /** 座標を設定するモックメソッド */
  setLngLat: (lngLat: [number, number]) => PopupMockInstance;
  /** テキストを設定するモックメソッド */
  setText: (text: string) => PopupMockInstance;
  /** 地図へ追加するモックメソッド */
  addTo: () => PopupMockInstance;
  /** Popupを取り除くモックメソッド */
  remove: ReturnType<typeof vi.fn>;
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
    const instance: MarkerMockInstance = {
      element: options.element,
      lngLat: null,
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
  const PopupMock = vi.fn().mockImplementation(function MockPopup() {
    const instance: PopupMockInstance = {
      lngLat: null,
      text: null,
      setLngLat(lngLat: [number, number]) {
        instance.lngLat = lngLat;
        return instance;
      },
      setText(text: string) {
        instance.text = text;
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
  return {
    // biome-ignore lint/style/useNamingConvention: maplibre-glの実APIに合わせクラス名(Map/Marker/Popup/AttributionControl)をPascalCaseのまま公開する
    default: { Map: MapMock, Marker: MarkerMock, Popup: PopupMock, AttributionControl: AttributionControlMock }
  };
});

const getMapInstance = () => vi.mocked(maplibregl.Map).mock.results[0].value;
/** テスト中に生成された全てのMarkerモックインスタンスを取得する */
const getMarkerInstances = () => vi.mocked(maplibregl.Marker).mock.results.map((result) => result.value);
/** テスト中に生成された全てのPopupモックインスタンスを取得する */
const getPopupInstances = () => vi.mocked(maplibregl.Popup).mock.results.map((result) => result.value);

/** mapInstance.onで登録された、自転車ログ用の'click'ハンドラ(map.on('click', handler)形式)を取り出す */
const getClickHandler = (mapInstance: ReturnType<typeof getMapInstance>) => {
  const call = mapInstance.on.mock.calls.find(
    ([event, second]: [string, unknown]) => event === 'click' && typeof second === 'function'
  );
  return call?.[1];
};

/** mapInstance.onで登録された、行政区画hit-test用の'click'ハンドラ(map.on('click', layerId, handler)形式)を取り出す */
const getAdminBoundaryClickHandler = (mapInstance: ReturnType<typeof getMapInstance>) => {
  const call = mapInstance.on.mock.calls.find(
    ([event, layerId]: [string, unknown]) => event === 'click' && layerId === ADMIN_BOUNDARY_HITTEST_FILL_LAYER_ID
  );
  return call?.[2];
};

/** mapInstance.onで登録された'mousemove'ハンドラを取り出す */
const getMouseMoveHandler = (mapInstance: ReturnType<typeof getMapInstance>) => {
  const call = mapInstance.on.mock.calls.find(([event]: [string]) => event === 'mousemove');
  return call?.[1];
};

const getSetDataMock = (sourceId: string) => setDataMocksBySourceId[sourceId];

describe('MapViewに関するテスト', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    expect(mapInstance.setLayoutProperty).toHaveBeenCalledWith('label_country_1', 'visibility', 'visible');
    expect(mapInstance.setLayoutProperty).toHaveBeenCalledWith('boundary_3', 'visibility', 'visible');
    expect(mapInstance.setLayoutProperty).toHaveBeenCalledWith('label_city', 'visibility', 'visible');
    expect(mapInstance.setLayoutProperty).toHaveBeenCalledWith(
      ADMIN_BOUNDARY_MUNICIPALITY_LAYER_ID,
      'visibility',
      'visible'
    );
  });

  test('layerVisibilityでadmin-boundaryがOFFのとき、行政区画の境界線・地名レイヤーがvisibility:noneになる', () => {
    renderWithChakra(
      <MapView layerVisibility={{ ...ALL_ON_VISIBILITY, 'admin-boundary': false }} {...DEFAULT_SELECTION_PROPS} />
    );
    const mapInstance = getMapInstance();

    expect(mapInstance.setLayoutProperty).toHaveBeenCalledWith('boundary_3', 'visibility', 'none');
    expect(mapInstance.setLayoutProperty).toHaveBeenCalledWith('label_city', 'visibility', 'none');
    expect(mapInstance.setLayoutProperty).toHaveBeenCalledWith(
      ADMIN_BOUNDARY_MUNICIPALITY_LAYER_ID,
      'visibility',
      'none'
    );
    // osm-place-nameは別カテゴリのため影響を受けない
    expect(mapInstance.setLayoutProperty).toHaveBeenCalledWith('label_country_1', 'visibility', 'visible');
  });

  test('スタイルロード時、市町村行政区画の境界線レイヤーが都道府県境界(boundary_3)と同じ見た目でboundary_3の手前に追加される', () => {
    renderWithChakra(<MapView layerVisibility={ALL_ON_VISIBILITY} {...DEFAULT_SELECTION_PROPS} />);
    const mapInstance = getMapInstance();

    expect(mapInstance.addLayer).toHaveBeenCalledWith(
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

  test('スタイルロード時、過去年代用の行政区画境界レイヤー(塗り・線・ラベル)が追加される', () => {
    renderWithChakra(<MapView layerVisibility={ALL_ON_VISIBILITY} {...DEFAULT_SELECTION_PROPS} />);
    const mapInstance = getMapInstance();

    expect(mapInstance.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'admin-boundary-historical-fill', type: 'fill' })
    );
    expect(mapInstance.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'admin-boundary-historical-line', type: 'line' })
    );
    expect(mapInstance.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'admin-boundary-historical-label', type: 'symbol' })
    );
  });

  test('adminBoundaryEraがcurrent以外のとき、過去年代の境界GeoJSONを取得しGeoJSONソースへ反映する', async () => {
    const featureCollection = { type: 'FeatureCollection' as const, features: [] };
    vi.mocked(fetchMunicipalityBoundaries).mockResolvedValue(featureCollection);
    const { rerender } = renderWithChakra(<MapView layerVisibility={ALL_ON_VISIBILITY} {...DEFAULT_SELECTION_PROPS} />);

    rerender(
      <MapView layerVisibility={ALL_ON_VISIBILITY} {...DEFAULT_SELECTION_PROPS} adminBoundaryEra="2000-10-01" />
    );

    await waitFor(() => {
      expect(fetchMunicipalityBoundaries).toHaveBeenCalledWith('2000-10-01');
    });
    await waitFor(() => {
      expect(getSetDataMock('admin-boundary-historical-source')).toHaveBeenCalledWith(featureCollection);
    });
  });

  test('adminBoundaryEraがcurrentのままのとき、hit-test用には境界データを取得するが過去年代用の表示ソースへは反映しない', async () => {
    const featureCollection = { type: 'FeatureCollection' as const, features: [] };
    vi.mocked(fetchMunicipalityBoundaries).mockResolvedValue(featureCollection);
    renderWithChakra(<MapView layerVisibility={ALL_ON_VISIBILITY} {...DEFAULT_SELECTION_PROPS} />);

    await waitFor(() => {
      expect(fetchMunicipalityBoundaries).toHaveBeenCalledWith('current');
    });
    await waitFor(() => {
      expect(getSetDataMock(ADMIN_BOUNDARY_HITTEST_SOURCE_ID)).toHaveBeenCalledWith(featureCollection);
    });
    expect(getSetDataMock('admin-boundary-historical-source')).not.toHaveBeenCalled();
  });

  test('adminBoundaryEraがcurrentから過去年代に変化したとき、現行の行政区画レイヤーが非表示になる', () => {
    const { rerender } = renderWithChakra(<MapView layerVisibility={ALL_ON_VISIBILITY} {...DEFAULT_SELECTION_PROPS} />);
    const mapInstance = getMapInstance();
    mapInstance.setLayoutProperty.mockClear();

    rerender(
      <MapView layerVisibility={ALL_ON_VISIBILITY} {...DEFAULT_SELECTION_PROPS} adminBoundaryEra="2000-10-01" />
    );

    expect(mapInstance.setLayoutProperty).toHaveBeenCalledWith('boundary_3', 'visibility', 'none');
    expect(mapInstance.setLayoutProperty).toHaveBeenCalledWith('label_city', 'visibility', 'none');
    expect(mapInstance.setLayoutProperty).toHaveBeenCalledWith(
      ADMIN_BOUNDARY_MUNICIPALITY_LAYER_ID,
      'visibility',
      'none'
    );
  });

  test('adminBoundaryEraが過去年代からcurrentに変化したとき、過去年代用のレイヤーが非表示になる', () => {
    const { rerender } = renderWithChakra(
      <MapView layerVisibility={ALL_ON_VISIBILITY} {...DEFAULT_SELECTION_PROPS} adminBoundaryEra="2000-10-01" />
    );
    const mapInstance = getMapInstance();
    mapInstance.setLayoutProperty.mockClear();

    rerender(<MapView layerVisibility={ALL_ON_VISIBILITY} {...DEFAULT_SELECTION_PROPS} adminBoundaryEra="current" />);

    expect(mapInstance.setLayoutProperty).toHaveBeenCalledWith('admin-boundary-historical-fill', 'visibility', 'none');
    expect(mapInstance.setLayoutProperty).toHaveBeenCalledWith('admin-boundary-historical-line', 'visibility', 'none');
    expect(mapInstance.setLayoutProperty).toHaveBeenCalledWith('admin-boundary-historical-label', 'visibility', 'none');
  });

  test('スタイルロード時、OFFのカテゴリに属するレイヤーはvisibility:noneになる', () => {
    renderWithChakra(<MapView layerVisibility={ALL_ON_VISIBILITY} {...DEFAULT_SELECTION_PROPS} />);
    const mapInstance = getMapInstance();

    expect(mapInstance.setLayoutProperty).toHaveBeenCalledWith(AERIAL_PHOTO_LAYER_ID, 'visibility', 'none');
    expect(mapInstance.setLayoutProperty).toHaveBeenCalledWith(BICYCLE_LOG_LAYER_ID, 'visibility', 'none');
    expect(mapInstance.setLayoutProperty).toHaveBeenCalledWith(BICYCLE_LOG_SELECTED_LAYER_ID, 'visibility', 'none');
    expect(mapInstance.setLayoutProperty).toHaveBeenCalledWith(
      BICYCLE_LOG_FOCUSED_OUTLINE_LAYER_ID,
      'visibility',
      'none'
    );
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
        paint: expect.objectContaining({
          'line-color': BICYCLE_LOG_LINE_COLOR_DEFAULT,
          'line-width': BICYCLE_LOG_LINE_WIDTH_DEFAULT
        })
      })
    );
    expect(mapInstance.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: BICYCLE_LOG_SELECTED_LAYER_ID,
        type: 'line',
        source: BICYCLE_LOG_SELECTED_SOURCE_ID,
        paint: expect.objectContaining({
          'line-color': BICYCLE_LOG_LINE_COLOR_SELECTED,
          'line-width': BICYCLE_LOG_LINE_WIDTH_SELECTED
        })
      })
    );
    // フォーカス中の線は、他の線に埋もれず視認できるよう地図背景色のハロー(縁取り)を本体の下に敷く
    expect(mapInstance.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: BICYCLE_LOG_FOCUSED_OUTLINE_LAYER_ID,
        type: 'line',
        source: BICYCLE_LOG_FOCUSED_SOURCE_ID,
        paint: expect.objectContaining({
          'line-color': BICYCLE_LOG_FOCUSED_OUTLINE_COLOR,
          'line-width': BICYCLE_LOG_FOCUSED_OUTLINE_WIDTH
        })
      })
    );
    expect(mapInstance.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: BICYCLE_LOG_FOCUSED_LAYER_ID,
        type: 'line',
        source: BICYCLE_LOG_FOCUSED_SOURCE_ID,
        paint: expect.objectContaining({
          'line-color': BICYCLE_LOG_LINE_COLOR_FOCUSED,
          'line-width': BICYCLE_LOG_LINE_WIDTH_FOCUSED
        })
      })
    );
    // レイヤーが追加された順（通常→選択→フォーカスのハロー→フォーカス本体）で手前に描画される
    const layerIdCallOrder = mapInstance.addLayer.mock.calls.map(([layer]: [{ id: string }]) => layer.id);
    expect(layerIdCallOrder.indexOf(BICYCLE_LOG_LAYER_ID)).toBeLessThan(
      layerIdCallOrder.indexOf(BICYCLE_LOG_SELECTED_LAYER_ID)
    );
    expect(layerIdCallOrder.indexOf(BICYCLE_LOG_SELECTED_LAYER_ID)).toBeLessThan(
      layerIdCallOrder.indexOf(BICYCLE_LOG_FOCUSED_OUTLINE_LAYER_ID)
    );
    expect(layerIdCallOrder.indexOf(BICYCLE_LOG_FOCUSED_OUTLINE_LAYER_ID)).toBeLessThan(
      layerIdCallOrder.indexOf(BICYCLE_LOG_FOCUSED_LAYER_ID)
    );
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
        selectedActivities={[createActivity({ id: '1' })]}
        focusedActivity={createActivity({ id: '1' })}
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

  test('selectedActivities・focusedActivityが変化すると、選択用レイヤーにフォーカス中を除いた選択中アクティビティが通し番号順で反映される', async () => {
    const activity1: CyclingActivity = {
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
    };
    const activity2: CyclingActivity = {
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
    };
    const activity3: CyclingActivity = {
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
    };
    const activities = [activity1, activity2, activity3];
    const { rerender } = renderWithChakra(
      <MapView layerVisibility={ALL_ON_VISIBILITY} {...DEFAULT_SELECTION_PROPS} filteredActivities={activities} />
    );

    rerender(
      <MapView
        layerVisibility={ALL_ON_VISIBILITY}
        {...DEFAULT_SELECTION_PROPS}
        filteredActivities={activities}
        selectedActivities={[activity2, activity3]}
        focusedActivity={activity3}
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
    const activity1: CyclingActivity = {
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
    };
    const activity2: CyclingActivity = {
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
    };
    const activities = [activity1, activity2];
    const { rerender } = renderWithChakra(
      <MapView layerVisibility={ALL_ON_VISIBILITY} {...DEFAULT_SELECTION_PROPS} filteredActivities={activities} />
    );

    // 通し番号0番が'2'、1番が'1'（クリック検出順が数値の昇順とは限らない例）
    rerender(
      <MapView
        layerVisibility={ALL_ON_VISIBILITY}
        {...DEFAULT_SELECTION_PROPS}
        filteredActivities={activities}
        selectedActivities={[activity2, activity1]}
        focusedActivity={null}
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
    const activityWithPath: CyclingActivity = {
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
      ]
    };

    test('何もフォーカスされていない場合、マーカーは表示されない', () => {
      renderWithChakra(
        <MapView
          layerVisibility={ALL_ON_VISIBILITY}
          {...DEFAULT_SELECTION_PROPS}
          filteredActivities={[activityWithPath]}
        />
      );

      expect(getMarkerInstances()).toHaveLength(0);
    });

    test('アクティビティをフォーカスすると、開始地点・終了地点にマーカーが表示される', async () => {
      const { rerender } = renderWithChakra(
        <MapView
          layerVisibility={ALL_ON_VISIBILITY}
          {...DEFAULT_SELECTION_PROPS}
          filteredActivities={[activityWithPath]}
        />
      );

      rerender(
        <MapView
          layerVisibility={ALL_ON_VISIBILITY}
          {...DEFAULT_SELECTION_PROPS}
          filteredActivities={[activityWithPath]}
          selectedActivities={[activityWithPath]}
          focusedActivity={activityWithPath}
        />
      );

      await waitFor(() => expect(getMarkerInstances()).toHaveLength(2));
      const lngLats = getMarkerInstances().map((marker) => marker.lngLat);
      expect(lngLats).toContainEqual([139.7, 35.6]);
      expect(lngLats).toContainEqual([139.8, 35.7]);
    });

    test('フォーカスを解除すると、マーカーが取り除かれる', async () => {
      const { rerender } = renderWithChakra(
        <MapView
          layerVisibility={ALL_ON_VISIBILITY}
          {...DEFAULT_SELECTION_PROPS}
          filteredActivities={[activityWithPath]}
          selectedActivities={[activityWithPath]}
          focusedActivity={activityWithPath}
        />
      );
      await waitFor(() => expect(getMarkerInstances()).toHaveLength(2));
      const previousMarkers = getMarkerInstances();

      rerender(
        <MapView
          layerVisibility={ALL_ON_VISIBILITY}
          {...DEFAULT_SELECTION_PROPS}
          filteredActivities={[activityWithPath]}
        />
      );

      await waitFor(() => {
        for (const marker of previousMarkers) {
          expect(marker.remove).toHaveBeenCalled();
          // Reactのroot.unmount()も呼ばれ、DOM要素の中身が空になっていることを確認する
          expect(marker.element.querySelector('svg')).toBeNull();
        }
      });
    });

    test('軌跡(path)を持たないアクティビティをフォーカスしても、マーカーは表示されない', async () => {
      const activityWithoutPath: CyclingActivity = { ...activityWithPath, path: null };
      const { rerender } = renderWithChakra(
        <MapView
          layerVisibility={ALL_ON_VISIBILITY}
          {...DEFAULT_SELECTION_PROPS}
          filteredActivities={[activityWithoutPath]}
        />
      );

      rerender(
        <MapView
          layerVisibility={ALL_ON_VISIBILITY}
          {...DEFAULT_SELECTION_PROPS}
          filteredActivities={[activityWithoutPath]}
          selectedActivities={[activityWithoutPath]}
          focusedActivity={activityWithoutPath}
        />
      );

      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(getMarkerInstances()).toHaveLength(0);
    });

    test('開始地点と終了地点が同じ座標の場合、スタートのマーカーが後に追加され手前に描画される', async () => {
      const roundTripActivity: CyclingActivity = {
        ...activityWithPath,
        path: [
          [
            [139.7, 35.6],
            [139.75, 35.65],
            [139.7, 35.6]
          ]
        ]
      };
      const { rerender } = renderWithChakra(
        <MapView
          layerVisibility={ALL_ON_VISIBILITY}
          {...DEFAULT_SELECTION_PROPS}
          filteredActivities={[roundTripActivity]}
        />
      );

      rerender(
        <MapView
          layerVisibility={ALL_ON_VISIBILITY}
          {...DEFAULT_SELECTION_PROPS}
          filteredActivities={[roundTripActivity]}
          selectedActivities={[roundTripActivity]}
          focusedActivity={roundTripActivity}
        />
      );

      await waitFor(() => expect(getMarkerInstances()).toHaveLength(2));
      // 後から地図に追加された方（配列の末尾）がスタートのマーカーであり、DOM上で手前に描画される
      const lastMarker = getMarkerInstances()[getMarkerInstances().length - 1];
      expect(lastMarker.element.innerHTML).toEqual(createStartMarkerElement().element.innerHTML);
    });
  });

  describe('行政区画のクリックによる範囲フォーカスに関するテスト（Issue #76）', () => {
    test('スタイルロード時、hit-test用・フォーカス表示用の空のGeoJSONソースが追加される', () => {
      renderWithChakra(<MapView layerVisibility={ALL_ON_VISIBILITY} {...DEFAULT_SELECTION_PROPS} />);
      const mapInstance = getMapInstance();
      const emptyData = { type: 'FeatureCollection', features: [] };

      expect(mapInstance.addSource).toHaveBeenCalledWith(ADMIN_BOUNDARY_HITTEST_SOURCE_ID, {
        type: 'geojson',
        data: emptyData
      });
      expect(mapInstance.addSource).toHaveBeenCalledWith(ADMIN_BOUNDARY_FOCUSED_SOURCE_ID, {
        type: 'geojson',
        data: emptyData
      });
    });

    test('行政区画hit-testレイヤーをクリックすると、検出した自治体でonFocusMunicipalityが呼ばれる', () => {
      const onFocusMunicipality = vi.fn();
      renderWithChakra(
        <MapView
          layerVisibility={ALL_ON_VISIBILITY}
          {...DEFAULT_SELECTION_PROPS}
          onFocusMunicipality={onFocusMunicipality}
        />
      );
      const mapInstance = getMapInstance();
      const handleClick = getAdminBoundaryClickHandler(mapInstance);

      handleClick({ features: [{ properties: { prefectureName: '東京都', municipalityName: '渋谷区' } }] });

      expect(onFocusMunicipality).toHaveBeenCalledWith({ prefectureName: '東京都', municipalityName: '渋谷区' });
    });

    test('focusedMunicipalityが指定されたとき、行政区画データを取得し一致するfeatureをフォーカス用オーバーレイへ反映する', async () => {
      const shibuyaFeature = {
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [139.7, 35.6] },
        properties: { prefectureName: '東京都', municipalityName: '渋谷区' }
      };
      const featureCollection = { type: 'FeatureCollection' as const, features: [shibuyaFeature] };
      vi.mocked(fetchMunicipalityBoundaries).mockResolvedValue(featureCollection);
      const { rerender } = renderWithChakra(
        <MapView layerVisibility={ALL_ON_VISIBILITY} {...DEFAULT_SELECTION_PROPS} />
      );

      rerender(
        <MapView
          layerVisibility={ALL_ON_VISIBILITY}
          {...DEFAULT_SELECTION_PROPS}
          focusedMunicipality={{ prefectureName: '東京都', municipalityName: '渋谷区' }}
        />
      );

      await waitFor(() => {
        expect(getSetDataMock(ADMIN_BOUNDARY_FOCUSED_SOURCE_ID)).toHaveBeenCalledWith({
          type: 'FeatureCollection',
          features: [shibuyaFeature]
        });
      });
    });

    test('focusedMunicipalityがnullに戻ったとき、フォーカス用オーバーレイが空になる', async () => {
      const featureCollection = { type: 'FeatureCollection' as const, features: [] };
      vi.mocked(fetchMunicipalityBoundaries).mockResolvedValue(featureCollection);
      const { rerender } = renderWithChakra(
        <MapView
          layerVisibility={ALL_ON_VISIBILITY}
          {...DEFAULT_SELECTION_PROPS}
          focusedMunicipality={{ prefectureName: '東京都', municipalityName: '渋谷区' }}
        />
      );

      rerender(<MapView layerVisibility={ALL_ON_VISIBILITY} {...DEFAULT_SELECTION_PROPS} focusedMunicipality={null} />);

      await waitFor(() => {
        expect(getSetDataMock(ADMIN_BOUNDARY_FOCUSED_SOURCE_ID)).toHaveBeenCalledWith({
          type: 'FeatureCollection',
          features: []
        });
      });
    });
  });

  describe('フォーカス中アクティビティの線ホバーによる距離表示に関するテスト（Issue #77）', () => {
    const activityWithPath: CyclingActivity = {
      id: '1',
      name: 'ライド1',
      distanceMeters: 1000,
      movingTimeSeconds: 600,
      elapsedTimeSeconds: 650,
      elevationGainMeters: 50,
      startDate: '2026-07-01T00:00:00Z',
      path: [
        [
          [139.0, 35.0],
          [139.0, 35.01]
        ]
      ]
    };

    test('フォーカス中アクティビティの線上をホバーすると、距離を示すPopupが表示される', () => {
      renderWithChakra(
        <MapView
          layerVisibility={ALL_ON_VISIBILITY}
          {...DEFAULT_SELECTION_PROPS}
          selectedActivities={[activityWithPath]}
          focusedActivity={activityWithPath}
        />
      );
      const mapInstance = getMapInstance();
      mapInstance.queryRenderedFeatures.mockReturnValue([{ properties: { id: '1' } }]);
      const handleMouseMove = getMouseMoveHandler(mapInstance);

      handleMouseMove({ point: { x: 100, y: 200 }, lngLat: { lng: 139.0, lat: 35.005 } });

      expect(getPopupInstances()).toHaveLength(1);
      expect(getPopupInstances()[0].lngLat).toEqual([139.0, 35.005]);
      expect(getPopupInstances()[0].text).toMatch(/km地点$/);
    });

    test('線から外れるとPopupが取り除かれる', () => {
      renderWithChakra(
        <MapView
          layerVisibility={ALL_ON_VISIBILITY}
          {...DEFAULT_SELECTION_PROPS}
          selectedActivities={[activityWithPath]}
          focusedActivity={activityWithPath}
        />
      );
      const mapInstance = getMapInstance();
      mapInstance.queryRenderedFeatures.mockReturnValue([{ properties: { id: '1' } }]);
      const handleMouseMove = getMouseMoveHandler(mapInstance);
      handleMouseMove({ point: { x: 100, y: 200 }, lngLat: { lng: 139.0, lat: 35.005 } });
      const popup = getPopupInstances()[0];

      mapInstance.queryRenderedFeatures.mockReturnValue([]);
      handleMouseMove({ point: { x: 300, y: 400 }, lngLat: { lng: 140.0, lat: 36.0 } });

      expect(popup.remove).toHaveBeenCalledTimes(1);
    });

    test('フォーカス中のアクティビティが無い場合、ホバーしてもPopupは表示されない', () => {
      renderWithChakra(<MapView layerVisibility={ALL_ON_VISIBILITY} {...DEFAULT_SELECTION_PROPS} />);
      const mapInstance = getMapInstance();
      const handleMouseMove = getMouseMoveHandler(mapInstance);

      handleMouseMove({ point: { x: 100, y: 200 }, lngLat: { lng: 139.0, lat: 35.005 } });

      expect(getPopupInstances()).toHaveLength(0);
    });
  });
});
