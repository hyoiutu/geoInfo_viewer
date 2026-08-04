import { renderHook } from '@testing-library/react';
import type maplibregl from 'maplibre-gl';
import { describe, expect, test, vi } from 'vitest';
import type { CyclingActivity } from '../../api/activitiesApi';
import * as mapLayerInteraction from '../../utils/mapLayerInteraction';
import { useAdminBoundaryClickInteraction } from '../useAdminBoundaryClickInteraction';

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

// テスト対象はregisterAdminBoundaryClickHandler呼び出し時にmapインスタンス自体をそのまま渡すだけのため、
// 実体を必要としないダミーオブジェクトへキャストする
const asMap = (mock: object): maplibregl.Map => mock as never;

describe('useAdminBoundaryClickInteractionに関するテスト（Issue #127）', () => {
  test('mapがnullの場合、registerAdminBoundaryClickHandlerは呼ばれない', () => {
    const spy = vi.spyOn(mapLayerInteraction, 'registerAdminBoundaryClickHandler').mockImplementation(() => {});
    const mapRef = { current: null };

    renderHook(() => useAdminBoundaryClickInteraction(mapRef, true, vi.fn(), null));

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  test('isStyleLoadedがfalseの場合、registerAdminBoundaryClickHandlerは呼ばれない', () => {
    const spy = vi.spyOn(mapLayerInteraction, 'registerAdminBoundaryClickHandler').mockImplementation(() => {});
    const mapRef = { current: asMap({}) };

    renderHook(() => useAdminBoundaryClickInteraction(mapRef, false, vi.fn(), null));

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  test('条件が揃っている場合、mapを渡してregisterAdminBoundaryClickHandlerが1度だけ呼ばれる', () => {
    const spy = vi.spyOn(mapLayerInteraction, 'registerAdminBoundaryClickHandler').mockImplementation(() => {});
    const map = asMap({});
    const mapRef = { current: map };

    renderHook(() => useAdminBoundaryClickInteraction(mapRef, true, vi.fn(), null));

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(map, expect.any(Function), expect.any(Function));
    spy.mockRestore();
  });

  test('渡されたonFocusMunicipalityは、登録されたコールバック経由で呼ばれる', () => {
    const spy = vi.spyOn(mapLayerInteraction, 'registerAdminBoundaryClickHandler').mockImplementation(() => {});
    const mapRef = { current: asMap({}) };
    const onFocusMunicipality = vi.fn();
    const municipality = { prefectureName: '東京都', municipalityName: '渋谷区' };

    renderHook(() => useAdminBoundaryClickInteraction(mapRef, true, onFocusMunicipality, null));
    const [, registeredOnFocusMunicipality] = spy.mock.calls[0] ?? [];
    registeredOnFocusMunicipality?.(municipality);

    expect(onFocusMunicipality).toHaveBeenCalledWith(municipality);
    spy.mockRestore();
  });

  test('渡されたfocusedActivityがnullでない場合、isFocused()はtrueを返す', () => {
    const spy = vi.spyOn(mapLayerInteraction, 'registerAdminBoundaryClickHandler').mockImplementation(() => {});
    const mapRef = { current: asMap({}) };

    renderHook(() => useAdminBoundaryClickInteraction(mapRef, true, vi.fn(), createActivity({ id: '1' })));
    const [, , isFocused] = spy.mock.calls[0] ?? [];

    expect(isFocused?.()).toBe(true);
    spy.mockRestore();
  });
});
