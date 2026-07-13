import { describe, expect, test } from 'vitest';
import type { CyclingActivity } from '../../api/activitiesApi';
import { calculateAverageSpeedKmh } from '../averageSpeed';

const createActivity = (overrides: Partial<CyclingActivity>): CyclingActivity => ({
  id: '1',
  name: 'テストライド',
  distanceMeters: 20000,
  movingTimeSeconds: 3600,
  elapsedTimeSeconds: 3900,
  elevationGainMeters: 200,
  startDate: '2026-06-15T01:00:00.000Z',
  path: null,
  ...overrides
});

describe('calculateAverageSpeedKmhに関するテスト', () => {
  test('走行距離÷走行時間(movingTimeSeconds)からkm/hを算出する', () => {
    const speed = calculateAverageSpeedKmh(createActivity({ distanceMeters: 36000, movingTimeSeconds: 3600 }));

    expect(speed).toBe(36);
  });

  test('走行時間が0の場合、ゼロ除算せず0を返す', () => {
    const speed = calculateAverageSpeedKmh(createActivity({ distanceMeters: 1000, movingTimeSeconds: 0 }));

    expect(speed).toBe(0);
  });
});
