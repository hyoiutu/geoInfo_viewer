// biome-ignore-all lint/style/useNamingConvention: Strava APIレスポンス形式(snake_case)に合わせたテストダブル

import { describe, expect, test } from 'vitest';
import type { StravaActivity } from '../../strava/types/strava-activity.type';
import { toCyclingActivityEntity } from '../cycling-activity-entity.util';

const createActivity = (overrides: Partial<StravaActivity>): StravaActivity => ({
  id: 42,
  name: 'テストライド',
  type: 'Ride',
  distance: 12345.6,
  moving_time: 3600,
  start_date: '2026-07-01T00:00:00Z',
  map: { summary_polyline: '' },
  ...overrides
});

describe('toCyclingActivityEntityに関するテスト', () => {
  test('StravaActivityのフィールドがEntityへ正しくマッピングされる', () => {
    const activity = createActivity({ id: 42, name: 'テストライド', distance: 12345.6, moving_time: 3600 });

    const entity = toCyclingActivityEntity(activity);

    expect(entity.id).toBe(42);
    expect(entity.name).toBe('テストライド');
    expect(entity.distanceMeters).toBe(12345.6);
    expect(entity.movingTimeSeconds).toBe(3600);
    expect(entity.startDate).toEqual(new Date('2026-07-01T00:00:00Z'));
  });

  test('summary_polylineが設定されている場合、GeoJSON LineStringにデコードされる', () => {
    const activity = createActivity({ map: { summary_polyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' } });

    const entity = toCyclingActivityEntity(activity);

    expect(entity.path).toEqual({
      type: 'LineString',
      coordinates: [
        [-120.2, 38.5],
        [-120.95, 40.7],
        [-126.453, 43.252]
      ]
    });
  });

  test('summary_polylineが空文字のとき、pathはnullになる', () => {
    const activity = createActivity({ map: { summary_polyline: '' } });

    const entity = toCyclingActivityEntity(activity);

    expect(entity.path).toBeNull();
  });
});
