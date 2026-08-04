import { renderHook } from '@testing-library/react';
import type maplibregl from 'maplibre-gl';
import { describe, expect, test, vi } from 'vitest';
import type { CyclingActivity } from '../../api/activitiesApi';
import { BICYCLE_LOG_SOURCE_ID, BICYCLE_LOG_SUMMARY_SOURCE_ID } from '../../constants/bicycleLog';
import { useBicycleLogDataSync } from '../useBicycleLogDataSync';

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

const createMockMap = () => {
  const setData = vi.fn();
  const summarySetData = vi.fn();
  const getSource = vi.fn((sourceId: string) => {
    if (sourceId === BICYCLE_LOG_SOURCE_ID) {
      return { setData };
    }
    if (sourceId === BICYCLE_LOG_SUMMARY_SOURCE_ID) {
      return { setData: summarySetData };
    }
    return undefined;
  });
  // テスト対象はmap.getSourceのみ呼ぶため、必要最小限のモックへキャストする
  const asMap = (mock: object): maplibregl.Map => mock as never;
  return { map: asMap({ getSource }), setData, summarySetData };
};

describe('useBicycleLogDataSyncに関するテスト（Issue #127）', () => {
  test('mapがnullの場合、setDataは呼ばれない', () => {
    const { setData, summarySetData } = createMockMap();
    const mapRef = { current: null };
    const activities = [createActivity({ id: '1' })];

    renderHook(() => useBicycleLogDataSync(mapRef, activities, true));

    expect(setData).not.toHaveBeenCalled();
    expect(summarySetData).not.toHaveBeenCalled();
  });

  test('isStyleLoadedがfalseの場合、setDataは呼ばれない', () => {
    const { map, setData, summarySetData } = createMockMap();
    const mapRef = { current: map };
    const activities = [createActivity({ id: '1' })];

    renderHook(() => useBicycleLogDataSync(mapRef, activities, false));

    expect(setData).not.toHaveBeenCalled();
    expect(summarySetData).not.toHaveBeenCalled();
  });

  test('mapがありisStyleLoadedがtrueの場合、通常用・summary用の両方のソースへsetDataが呼ばれる', () => {
    const { map, setData, summarySetData } = createMockMap();
    const mapRef = { current: map };
    const activities = [createActivity({ id: '1' })];

    renderHook(() => useBicycleLogDataSync(mapRef, activities, true));

    expect(setData).toHaveBeenCalledTimes(1);
    expect(summarySetData).toHaveBeenCalledTimes(1);
  });

  test('filteredActivitiesが変化すると、setDataが再度呼ばれる', () => {
    const { map, setData } = createMockMap();
    const mapRef = { current: map };
    const { rerender } = renderHook(({ activities }) => useBicycleLogDataSync(mapRef, activities, true), {
      initialProps: { activities: [createActivity({ id: '1' })] }
    });
    setData.mockClear();

    rerender({ activities: [createActivity({ id: '1' }), createActivity({ id: '2' })] });

    expect(setData).toHaveBeenCalledTimes(1);
  });
});
