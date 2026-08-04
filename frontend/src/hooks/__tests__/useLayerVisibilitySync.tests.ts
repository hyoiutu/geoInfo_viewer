import { renderHook } from '@testing-library/react';
import type maplibregl from 'maplibre-gl';
import { describe, expect, test, vi } from 'vitest';
import type { CategorizedLayerIds, LayerVisibility } from '../../types/layer';
import * as mapLayerInteraction from '../../utils/mapLayerInteraction';
import { useLayerVisibilitySync } from '../useLayerVisibilitySync';

const VISIBILITY: LayerVisibility = {
  'osm-poi': true,
  'osm-road': true,
  'osm-building': true,
  'osm-place-name': true,
  'admin-boundary': true,
  'aerial-photo': false,
  'bicycle-log': false
};

const CATEGORIZED_LAYER_IDS: CategorizedLayerIds = {
  'osm-poi': [],
  'osm-road': [],
  'osm-building': [],
  'osm-place-name': [],
  'admin-boundary': [],
  'aerial-photo': [],
  'bicycle-log': []
};

// テスト対象はapplyLayerVisibility呼び出し時にmapインスタンス自体をそのまま渡すだけのため、
// 実体を必要としないダミーオブジェクトへキャストする
const asMap = (mock: object): maplibregl.Map => mock as never;

describe('useLayerVisibilitySyncに関するテスト（Issue #127）', () => {
  test('mapがnullの場合、applyLayerVisibilityは呼ばれない', () => {
    const spy = vi.spyOn(mapLayerInteraction, 'applyLayerVisibility').mockImplementation(() => {});
    const mapRef = { current: null };
    const categorizedLayerIdsRef = { current: CATEGORIZED_LAYER_IDS };

    renderHook(() => useLayerVisibilitySync(mapRef, categorizedLayerIdsRef, VISIBILITY, 'current', true));

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  test('categorizedLayerIdsRef.currentがnullの場合、applyLayerVisibilityは呼ばれない', () => {
    const spy = vi.spyOn(mapLayerInteraction, 'applyLayerVisibility').mockImplementation(() => {});
    const mapRef = { current: asMap({}) };
    const categorizedLayerIdsRef = { current: null };

    renderHook(() => useLayerVisibilitySync(mapRef, categorizedLayerIdsRef, VISIBILITY, 'current', true));

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  test('isStyleLoadedがfalseの場合、applyLayerVisibilityは呼ばれない', () => {
    const spy = vi.spyOn(mapLayerInteraction, 'applyLayerVisibility').mockImplementation(() => {});
    const mapRef = { current: asMap({}) };
    const categorizedLayerIdsRef = { current: CATEGORIZED_LAYER_IDS };

    renderHook(() => useLayerVisibilitySync(mapRef, categorizedLayerIdsRef, VISIBILITY, 'current', false));

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  test('条件が揃っている場合、layerVisibility・adminBoundaryEraを渡してapplyLayerVisibilityが呼ばれる', () => {
    const spy = vi.spyOn(mapLayerInteraction, 'applyLayerVisibility').mockImplementation(() => {});
    const map = asMap({});
    const mapRef = { current: map };
    const categorizedLayerIdsRef = { current: CATEGORIZED_LAYER_IDS };

    renderHook(() => useLayerVisibilitySync(mapRef, categorizedLayerIdsRef, VISIBILITY, '2000-10-01', true));

    expect(spy).toHaveBeenCalledWith(map, CATEGORIZED_LAYER_IDS, VISIBILITY, '2000-10-01');
    spy.mockRestore();
  });
});
