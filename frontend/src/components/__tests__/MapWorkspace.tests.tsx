import { fireEvent, waitFor } from '@testing-library/react';
import maplibregl from 'maplibre-gl';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { renderWithChakra } from '../../test-utils/renderWithChakra';
import { MapWorkspace } from '../MapWorkspace';

const FIXTURE_STYLE_LAYERS = [
  { id: 'background', type: 'background' },
  { id: 'road_motorway', type: 'line', 'source-layer': 'transportation' },
  { id: 'building', type: 'fill', 'source-layer': 'building' },
  { id: 'poi_r1', type: 'symbol', 'source-layer': 'poi' },
  { id: 'label_city', type: 'symbol', 'source-layer': 'place' }
];

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

describe('MapWorkspaceに関するテスト', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('道路レイヤーのトグルをOFFにすると、地図の道路レイヤーが非表示になる', async () => {
    const { getByRole } = renderWithChakra(<MapWorkspace />);
    const mapInstance = getMapInstance();
    mapInstance.setLayoutProperty.mockClear();

    fireEvent.click(getByRole('checkbox', { name: '道路' }));

    await waitFor(() =>
      expect(mapInstance.setLayoutProperty).toHaveBeenCalledWith('road_motorway', 'visibility', 'none')
    );
  });

  test('航空写真レイヤーのトグルをONにすると、地図の航空写真レイヤーが表示される', async () => {
    const { getByRole } = renderWithChakra(<MapWorkspace />);
    const mapInstance = getMapInstance();
    mapInstance.setLayoutProperty.mockClear();

    fireEvent.click(getByRole('checkbox', { name: '航空写真' }));

    await waitFor(() =>
      expect(mapInstance.setLayoutProperty).toHaveBeenCalledWith('aerial-photo-layer', 'visibility', 'visible')
    );
  });
});
