import { renderHook } from '@testing-library/react';
import type maplibregl from 'maplibre-gl';
import { describe, expect, test, vi } from 'vitest';
import type { CyclingActivity } from '../../api/activitiesApi';
import * as mapLayerInteraction from '../../utils/mapLayerInteraction';
import { useSelectionLayerSync } from '../useSelectionLayerSync';

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

// テスト対象はapplySelectionLayers呼び出し時にmapインスタンス自体をそのまま渡すだけのため、
// 実体を必要としないダミーオブジェクトへキャストする
const asMap = (mock: object): maplibregl.Map => mock as never;

describe('useSelectionLayerSyncに関するテスト（Issue #127）', () => {
  test('mapがnullの場合、applySelectionLayersは呼ばれない', () => {
    const spy = vi.spyOn(mapLayerInteraction, 'applySelectionLayers').mockImplementation(() => {});
    const mapRef = { current: null };

    renderHook(() => useSelectionLayerSync(mapRef, [], null, true));

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  test('isStyleLoadedがfalseの場合、applySelectionLayersは呼ばれない', () => {
    const spy = vi.spyOn(mapLayerInteraction, 'applySelectionLayers').mockImplementation(() => {});
    const mapRef = { current: asMap({}) };

    renderHook(() => useSelectionLayerSync(mapRef, [], null, false));

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  test('mapがありisStyleLoadedがtrueの場合、selectedActivities・focusedActivityを渡してapplySelectionLayersが呼ばれる', () => {
    const spy = vi.spyOn(mapLayerInteraction, 'applySelectionLayers').mockImplementation(() => {});
    const map = asMap({});
    const mapRef = { current: map };
    const selectedActivities = [createActivity({ id: '1' })];
    const focusedActivity = createActivity({ id: '1' });

    renderHook(() => useSelectionLayerSync(mapRef, selectedActivities, focusedActivity, true));

    expect(spy).toHaveBeenCalledWith(map, selectedActivities, focusedActivity);
    spy.mockRestore();
  });
});
