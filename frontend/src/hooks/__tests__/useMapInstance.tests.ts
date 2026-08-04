import { renderHook, waitFor } from '@testing-library/react';
import maplibregl from 'maplibre-gl';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import * as mapLayerSetup from '../../utils/mapLayerSetup';
import { useMapInstance } from '../useMapInstance';

const FIXTURE_STYLE_LAYERS = [
  { id: 'background', type: 'background' },
  { id: 'road_motorway', type: 'line', 'source-layer': 'transportation' }
];

vi.mock('maplibre-gl', () => {
  const remove = vi.fn();
  const once = vi.fn((event: string, callback: () => void) => {
    if (event === 'load') {
      callback();
    }
  });
  const getStyle = vi.fn(() => ({ layers: FIXTURE_STYLE_LAYERS }));
  const addControl = vi.fn();
  const MapMock = vi.fn().mockImplementation(function MockMap() {
    return { remove, once, getStyle, addControl };
  });
  const AttributionControlMock = vi.fn();
  return {
    // biome-ignore lint/style/useNamingConvention: maplibre-glの実APIに合わせクラス名(Map/AttributionControl)をPascalCaseのまま公開する
    default: { Map: MapMock, AttributionControl: AttributionControlMock }
  };
});

// このフックはスタイル読み込み完了時に初期レイヤーを追加する実関数(addAerialPhotoLayer等)を呼ぶが、
// これらはmap.addSource等モックMapが実装しないメソッドを呼ぶため、実装を無効化してモック化する
vi.mock('../../utils/mapLayerSetup', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/mapLayerSetup')>();
  return {
    ...actual,
    addAerialPhotoLayer: vi.fn(),
    addAdminBoundaryLayer: vi.fn(),
    addAdminBoundaryHistoricalLayer: vi.fn(),
    addAdminBoundaryFocusLayer: vi.fn(),
    addBicycleLogLayer: vi.fn()
  };
});

const getMapInstance = () => vi.mocked(maplibregl.Map).mock.results[0]?.value;

// テスト対象はmap.once等の呼び出しのみ行うため、必要最小限のモックへキャストする
const asMap = (mock: object): maplibregl.Map => mock as never;

describe('useMapInstanceに関するテスト（Issue #127）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('containerRef.currentが無い場合、地図は生成されない', () => {
    const containerRef = { current: null };

    renderHook(() => useMapInstance(containerRef));

    expect(maplibregl.Map).not.toHaveBeenCalled();
  });

  test('マウント時にcontainerRef.currentを指定して地図が生成される', () => {
    const container = document.createElement('div');
    const containerRef = { current: container };

    renderHook(() => useMapInstance(containerRef));

    expect(maplibregl.Map).toHaveBeenCalledWith(expect.objectContaining({ container }));
  });

  test('スタイル読み込み完了前は、isStyleLoadedはfalseでmapRef.currentは生成済みの地図インスタンスを指す', () => {
    const containerRef = { current: document.createElement('div') };
    // loadコールバックを即座に呼ばないようにモックを差し替える。'function'宣言を使う必要がある
    // （アロー関数はnewで呼び出せずis not a constructorエラーになるため。test_rules.md参照）。
    vi.mocked(maplibregl.Map).mockImplementationOnce(function MockMapNotLoaded() {
      return asMap({
        remove: vi.fn(),
        once: vi.fn(),
        getStyle: vi.fn(() => ({ layers: FIXTURE_STYLE_LAYERS })),
        addControl: vi.fn()
      });
    });

    const { result } = renderHook(() => useMapInstance(containerRef));

    expect(result.current.isStyleLoaded).toBe(false);
    expect(result.current.mapRef.current).not.toBeNull();
  });

  test('スタイル読み込み完了後、isStyleLoadedがtrueになり、初期レイヤーが追加される', async () => {
    const containerRef = { current: document.createElement('div') };

    const { result } = renderHook(() => useMapInstance(containerRef));

    await waitFor(() => expect(result.current.isStyleLoaded).toBe(true));
    expect(mapLayerSetup.addAerialPhotoLayer).toHaveBeenCalledTimes(1);
    expect(mapLayerSetup.addAdminBoundaryLayer).toHaveBeenCalledTimes(1);
    expect(mapLayerSetup.addAdminBoundaryHistoricalLayer).toHaveBeenCalledTimes(1);
    expect(mapLayerSetup.addAdminBoundaryFocusLayer).toHaveBeenCalledTimes(1);
    expect(mapLayerSetup.addBicycleLogLayer).toHaveBeenCalledTimes(1);
    expect(result.current.categorizedLayerIdsRef.current).not.toBeNull();
  });

  test('アンマウントされたとき、地図のremoveが呼ばれる', () => {
    const containerRef = { current: document.createElement('div') };
    const { unmount } = renderHook(() => useMapInstance(containerRef));
    const mapInstance = getMapInstance();

    unmount();

    expect(mapInstance.remove).toHaveBeenCalledTimes(1);
  });
});
