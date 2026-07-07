import { act, renderHook } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { useLayerVisibility } from '../useLayerVisibility';

describe('useLayerVisibilityに関するテスト', () => {
  test('初期状態では、OSM系レイヤーがON・航空写真がOFFになっている', () => {
    const { result } = renderHook(() => useLayerVisibility());

    expect(result.current.visibility).toEqual({
      'osm-poi': true,
      'osm-road': true,
      'osm-building': true,
      'osm-place-name': true,
      'aerial-photo': false
    });
  });

  test('ONのレイヤーをtoggleLayerで切り替えると、OFFになる', () => {
    const { result } = renderHook(() => useLayerVisibility());

    act(() => {
      result.current.toggleLayer('osm-road');
    });

    expect(result.current.visibility['osm-road']).toBe(false);
  });

  test('OFFのレイヤーをtoggleLayerで切り替えると、ONになる', () => {
    const { result } = renderHook(() => useLayerVisibility());

    act(() => {
      result.current.toggleLayer('aerial-photo');
    });

    expect(result.current.visibility['aerial-photo']).toBe(true);
  });

  test('あるレイヤーをtoggleLayerで切り替えても、他のレイヤーの状態は変化しない', () => {
    const { result } = renderHook(() => useLayerVisibility());

    act(() => {
      result.current.toggleLayer('osm-poi');
    });

    expect(result.current.visibility['osm-road']).toBe(true);
    expect(result.current.visibility['osm-building']).toBe(true);
    expect(result.current.visibility['osm-place-name']).toBe(true);
    expect(result.current.visibility['aerial-photo']).toBe(false);
  });
});
