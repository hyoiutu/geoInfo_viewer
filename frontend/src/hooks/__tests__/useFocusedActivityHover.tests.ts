import { renderHook } from '@testing-library/react';
import type maplibregl from 'maplibre-gl';
import { describe, expect, test, vi } from 'vitest';
import type { CyclingActivity } from '../../api/activitiesApi';
import * as mapLayerInteraction from '../../utils/mapLayerInteraction';
import { useFocusedActivityHover } from '../useFocusedActivityHover';

const createActivity = (overrides: Partial<CyclingActivity>): CyclingActivity => ({
  id: '1',
  name: 'テストライド',
  distanceMeters: 1000,
  movingTimeSeconds: 600,
  elapsedTimeSeconds: 650,
  elevationGainMeters: 50,
  startDate: '2026-07-01T00:00:00Z',
  path: null,
  summaryPath: null,
  ...overrides
});

// テスト対象はregisterFocusedActivityHoverHandler呼び出し時にmapインスタンス自体をそのまま渡すだけのため、
// 実体を必要としないダミーオブジェクトへキャストする
const asMap = (mock: object): maplibregl.Map => mock as never;

describe('useFocusedActivityHoverに関するテスト（Issue #127）', () => {
  test('mapがnullの場合、registerFocusedActivityHoverHandlerは呼ばれない', () => {
    const spy = vi.spyOn(mapLayerInteraction, 'registerFocusedActivityHoverHandler').mockImplementation(() => {});
    const mapRef = { current: null };

    renderHook(() => useFocusedActivityHover(mapRef, true, null));

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  test('isStyleLoadedがfalseの場合、registerFocusedActivityHoverHandlerは呼ばれない', () => {
    const spy = vi.spyOn(mapLayerInteraction, 'registerFocusedActivityHoverHandler').mockImplementation(() => {});
    const mapRef = { current: asMap({}) };

    renderHook(() => useFocusedActivityHover(mapRef, false, null));

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  test('条件が揃っている場合、mapを渡してregisterFocusedActivityHoverHandlerが1度だけ呼ばれる', () => {
    const spy = vi.spyOn(mapLayerInteraction, 'registerFocusedActivityHoverHandler').mockImplementation(() => {});
    const map = asMap({});
    const mapRef = { current: map };

    renderHook(() => useFocusedActivityHover(mapRef, true, null));

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(map, expect.any(Function), expect.any(Function), expect.any(Function));
    spy.mockRestore();
  });

  test('getFocusedActivityは、渡された最新のfocusedActivityを返す', () => {
    const spy = vi.spyOn(mapLayerInteraction, 'registerFocusedActivityHoverHandler').mockImplementation(() => {});
    const mapRef = { current: asMap({}) };
    const focusedActivity = createActivity({ id: '1' });

    renderHook(() => useFocusedActivityHover(mapRef, true, focusedActivity));
    const [, getFocusedActivity] = spy.mock.calls[0] ?? [];

    expect(getFocusedActivity?.()).toEqual(focusedActivity);
    spy.mockRestore();
  });
});
