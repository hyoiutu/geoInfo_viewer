// biome-ignore-all lint/style/useNamingConvention: Strava APIレスポンス形式(snake_case)に合わせたテストダブル
import { describe, expect, test } from 'vitest';
import { isCyclingActivity } from '../strava-activity.util';
import type { StravaActivity } from '../types/strava-activity.type';

const createActivity = (overrides: Partial<StravaActivity>): StravaActivity => ({
  id: 1,
  name: 'テストライド',
  type: 'Ride',
  distance: 10000,
  moving_time: 1800,
  start_date: '2026-07-01T00:00:00Z',
  map: { summary_polyline: '' },
  ...overrides
});

describe('isCyclingActivityに関するテスト', () => {
  test('typeがRideのとき、trueを返す', () => {
    expect(isCyclingActivity(createActivity({ type: 'Ride' }))).toBe(true);
  });

  test('typeがVirtualRideのとき、trueを返す', () => {
    expect(isCyclingActivity(createActivity({ type: 'VirtualRide' }))).toBe(true);
  });

  test('typeがRunのとき、falseを返す', () => {
    expect(isCyclingActivity(createActivity({ type: 'Run' }))).toBe(false);
  });
});
