import maplibregl from 'maplibre-gl';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { renderWithChakra } from '../../test-utils/renderWithChakra';
import { MapView } from '../MapView';

vi.mock('maplibre-gl', () => {
  const remove = vi.fn();
  const MapMock = vi.fn().mockImplementation(function MockMap() {
    return { remove };
  });
  // biome-ignore lint/style/useNamingConvention: maplibre-glの実APIに合わせクラス名(Map)をPascalCaseのまま公開する
  return { default: { Map: MapMock } };
});

describe('MapViewに関するテスト', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('マウントされたとき、コンテナ要素を指定して地図が生成される', () => {
    const { getByTestId } = renderWithChakra(<MapView />);

    const container = getByTestId('map-container');

    expect(maplibregl.Map).toHaveBeenCalledWith(expect.objectContaining({ container }));
  });

  test('アンマウントされたとき、地図のremoveが呼ばれる', () => {
    const { unmount } = renderWithChakra(<MapView />);
    const mapInstance = vi.mocked(maplibregl.Map).mock.results[0].value;

    unmount();

    expect(mapInstance.remove).toHaveBeenCalledTimes(1);
  });
});
