import { describe, expect, test } from 'vitest';
import type { CyclingActivity } from '../../api/activitiesApi';
import { toActivityStatisticsView } from '../activityStatistics';

const createActivity = (overrides: Partial<CyclingActivity>): CyclingActivity => ({
  id: '1',
  name: 'テストライド',
  distanceMeters: 12345,
  movingTimeSeconds: 3600,
  elapsedTimeSeconds: 3900,
  elevationGainMeters: 250.5,
  startDate: '2026-07-01T01:00:00.000Z',
  path: null,
  ...overrides
});

describe('toActivityStatisticsViewに関するテスト', () => {
  test('アクティビティが0件の場合、全アクティビティ数は0、総走行距離数は0.0 kmを返す', () => {
    const view = toActivityStatisticsView([]);

    expect(view.totalCount).toBe(0);
    expect(view.totalDistanceKm).toBe('0.0 km');
  });

  test('アクティビティ件数をそのまま全アクティビティ数として返す', () => {
    const view = toActivityStatisticsView([
      createActivity({ id: '1' }),
      createActivity({ id: '2' }),
      createActivity({ id: '3' })
    ]);

    expect(view.totalCount).toBe(3);
  });

  test('全アクティビティの走行距離の合計をkm単位・小数第1位で返す', () => {
    const view = toActivityStatisticsView([
      createActivity({ distanceMeters: 12345 }),
      createActivity({ distanceMeters: 7655 })
    ]);

    expect(view.totalDistanceKm).toBe('20.0 km');
  });
});
