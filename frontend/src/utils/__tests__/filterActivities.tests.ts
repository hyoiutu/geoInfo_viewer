import { describe, expect, test } from 'vitest';
import type { CyclingActivity } from '../../api/activitiesApi';
import { DEFAULT_ACTIVITY_FILTER } from '../../types/activityFilter';
import { filterActivities, isActivityFilterValid } from '../filterActivities';

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

describe('filterActivitesに関するテスト', () => {
  test('フィルタが全て未入力の場合、全件返す', () => {
    const activities = [createActivity({ id: '1' }), createActivity({ id: '2' })];

    const result = filterActivities(activities, DEFAULT_ACTIVITY_FILTER);

    expect(result).toEqual(activities);
  });

  describe('年月フィルタ', () => {
    test('開始年のみ入力（月未入力）の場合、その年の1月以降を含む', () => {
      const activities = [
        createActivity({ id: 'before', startDate: '2025-12-31T12:00:00.000Z' }),
        createActivity({ id: 'january', startDate: '2026-01-01T12:00:00.000Z' })
      ];

      const result = filterActivities(activities, { ...DEFAULT_ACTIVITY_FILTER, startYear: 2026 });

      expect(result.map((activity) => activity.id)).toEqual(['january']);
    });

    test('開始年月を入力した場合、その年月以降を含む（その年月未満は除外）', () => {
      const activities = [
        createActivity({ id: 'before', startDate: '2026-02-28T12:00:00.000Z' }),
        createActivity({ id: 'onOrAfter', startDate: '2026-03-01T12:00:00.000Z' })
      ];

      const result = filterActivities(activities, { ...DEFAULT_ACTIVITY_FILTER, startYear: 2026, startMonth: 3 });

      expect(result.map((activity) => activity.id)).toEqual(['onOrAfter']);
    });

    test('終了年のみ入力（月未入力）の場合、その年の12月末まで含む', () => {
      const activities = [
        createActivity({ id: 'within', startDate: '2026-12-31T12:00:00.000Z' }),
        createActivity({ id: 'after', startDate: '2027-01-01T12:00:00.000Z' })
      ];

      const result = filterActivities(activities, { ...DEFAULT_ACTIVITY_FILTER, endYear: 2026 });

      expect(result.map((activity) => activity.id)).toEqual(['within']);
    });

    test('終了年月を入力した場合、その年月末まで含む（inclusive）', () => {
      const activities = [
        createActivity({ id: 'lastDayOfMonth', startDate: '2026-03-31T12:00:00.000Z' }),
        createActivity({ id: 'nextMonth', startDate: '2026-04-01T12:00:00.000Z' })
      ];

      const result = filterActivities(activities, { ...DEFAULT_ACTIVITY_FILTER, endYear: 2026, endMonth: 3 });

      expect(result.map((activity) => activity.id)).toEqual(['lastDayOfMonth']);
    });

    test('開始のみ入力した場合、終了は現在年月とみなす', () => {
      const now = new Date('2026-07-15T00:00:00.000Z');
      const activities = [
        createActivity({ id: 'withinCurrentMonth', startDate: '2026-07-10T00:00:00.000Z' }),
        createActivity({ id: 'futureMonth', startDate: '2026-08-01T00:00:00.000Z' })
      ];

      const result = filterActivities(activities, { ...DEFAULT_ACTIVITY_FILTER, startYear: 2026 }, now);

      expect(result.map((activity) => activity.id)).toEqual(['withinCurrentMonth']);
    });

    test('終了のみ入力した場合、開始は1980年1月とみなす', () => {
      const activities = [
        createActivity({ id: 'veryOld', startDate: '1980-01-01T00:00:00.000Z' }),
        createActivity({ id: 'beforeThat', startDate: '1979-12-31T00:00:00.000Z' })
      ];

      const result = filterActivities(activities, { ...DEFAULT_ACTIVITY_FILTER, endYear: 2026 });

      expect(result.map((activity) => activity.id)).toEqual(['veryOld']);
    });
  });

  describe('獲得標高フィルタ', () => {
    test('指定値以上の獲得標高のアクティビティのみ含む', () => {
      const activities = [
        createActivity({ id: 'below', elevationGainMeters: 99 }),
        createActivity({ id: 'exact', elevationGainMeters: 100 }),
        createActivity({ id: 'above', elevationGainMeters: 101 })
      ];

      const result = filterActivities(activities, { ...DEFAULT_ACTIVITY_FILTER, minElevationGainMeters: 100 });

      expect(result.map((activity) => activity.id)).toEqual(['exact', 'above']);
    });
  });

  describe('平均時速フィルタ', () => {
    test('指定値以上の平均時速のアクティビティのみ含む', () => {
      const activities = [
        // 20km / 1時間 = 20km/h
        createActivity({ id: 'exact', distanceMeters: 20000, movingTimeSeconds: 3600 }),
        // 10km / 1時間 = 10km/h
        createActivity({ id: 'below', distanceMeters: 10000, movingTimeSeconds: 3600 })
      ];

      const result = filterActivities(activities, { ...DEFAULT_ACTIVITY_FILTER, minAverageSpeedKmh: 20 });

      expect(result.map((activity) => activity.id)).toEqual(['exact']);
    });

    test('走行時間が0のアクティビティは平均時速0として扱われ、最低速度指定があると除外される', () => {
      const activities = [createActivity({ id: 'zeroTime', distanceMeters: 1000, movingTimeSeconds: 0 })];

      const result = filterActivities(activities, { ...DEFAULT_ACTIVITY_FILTER, minAverageSpeedKmh: 1 });

      expect(result).toEqual([]);
    });
  });

  describe('走行距離フィルタ', () => {
    test('指定値以上の走行距離のアクティビティのみ含む', () => {
      const activities = [
        createActivity({ id: 'below', distanceMeters: 9999 }),
        createActivity({ id: 'exact', distanceMeters: 10000 })
      ];

      const result = filterActivities(activities, { ...DEFAULT_ACTIVITY_FILTER, minDistanceKm: 10 });

      expect(result.map((activity) => activity.id)).toEqual(['exact']);
    });
  });

  test('複数条件はAND（全て満たすもののみ）で組み合わされる', () => {
    const activities = [
      // 距離は条件を満たすが標高が満たさない
      createActivity({ id: 'onlyDistanceMatches', distanceMeters: 20000, elevationGainMeters: 50 }),
      // 両方満たす
      createActivity({ id: 'bothMatch', distanceMeters: 20000, elevationGainMeters: 200 })
    ];

    const result = filterActivities(activities, {
      ...DEFAULT_ACTIVITY_FILTER,
      minDistanceKm: 10,
      minElevationGainMeters: 100
    });

    expect(result.map((activity) => activity.id)).toEqual(['bothMatch']);
  });
});

describe('isActivityFilterValidに関するテスト', () => {
  test('全て未入力の場合、有効とする', () => {
    expect(isActivityFilterValid(DEFAULT_ACTIVITY_FILTER)).toBe(true);
  });

  test('開始年月が両方入力されている場合、有効とする', () => {
    expect(isActivityFilterValid({ ...DEFAULT_ACTIVITY_FILTER, startYear: 2026, startMonth: 1 })).toBe(true);
  });

  test('開始年のみ入力（月未入力）の場合、有効とする', () => {
    expect(isActivityFilterValid({ ...DEFAULT_ACTIVITY_FILTER, startYear: 2026 })).toBe(true);
  });

  test('開始月のみ入力され年が未入力の場合、無効とする', () => {
    expect(isActivityFilterValid({ ...DEFAULT_ACTIVITY_FILTER, startMonth: 1 })).toBe(false);
  });

  test('終了月のみ入力され年が未入力の場合、無効とする', () => {
    expect(isActivityFilterValid({ ...DEFAULT_ACTIVITY_FILTER, endMonth: 12 })).toBe(false);
  });
});
