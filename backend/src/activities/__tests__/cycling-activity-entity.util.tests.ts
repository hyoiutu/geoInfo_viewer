// biome-ignore-all lint/style/useNamingConvention: Strava APIレスポンス形式(snake_case)に合わせたテストダブル

import { describe, expect, test } from 'vitest';
import type { StravaActivity, StravaActivityDetail } from '../../strava/types/strava-activity.type';
import { toCyclingActivityEntityFromDetail, toPlaceholderCyclingActivityEntity } from '../cycling-activity-entity.util';

const createActivity = (overrides: Partial<StravaActivity>): StravaActivity => ({
  id: 42,
  name: 'テストライド',
  type: 'Ride',
  distance: 12345.6,
  moving_time: 3600,
  start_date: '2026-07-01T00:00:00Z',
  map: { summary_polyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' },
  ...overrides
});

const createActivityDetail = (overrides: Partial<StravaActivityDetail>): StravaActivityDetail => ({
  id: 42,
  name: 'テストライド',
  type: 'Ride',
  distance: 12345.6,
  moving_time: 3600,
  start_date: '2026-07-01T00:00:00Z',
  map: { summary_polyline: '', polyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' },
  ...overrides
});

describe('toPlaceholderCyclingActivityEntityに関するテスト', () => {
  test('StravaActivityの基本フィールドがEntityへマッピングされる', () => {
    const activity = createActivity({ id: 42, name: 'テストライド', distance: 12345.6, moving_time: 3600 });

    const entity = toPlaceholderCyclingActivityEntity(activity);

    expect(entity.id).toBe(42);
    expect(entity.name).toBe('テストライド');
    expect(entity.distanceMeters).toBe(12345.6);
    expect(entity.movingTimeSeconds).toBe(3600);
    expect(entity.startDate).toEqual(new Date('2026-07-01T00:00:00Z'));
  });

  test('summary_polylineが設定されていても、pathは常にnullになる（詳細取得までは位置情報を保持しない）', () => {
    const activity = createActivity({ map: { summary_polyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' } });

    const entity = toPlaceholderCyclingActivityEntity(activity);

    expect(entity.path).toBeNull();
  });

  test('detailFetchedAtは常にnullになる（未取得を表す）', () => {
    const activity = createActivity({});

    const entity = toPlaceholderCyclingActivityEntity(activity);

    expect(entity.detailFetchedAt).toBeNull();
  });
});

describe('toCyclingActivityEntityFromDetailに関するテスト', () => {
  test('StravaActivityDetailの基本フィールドがEntityへマッピングされる', () => {
    const detail = createActivityDetail({ id: 42, name: 'テストライド', distance: 12345.6, moving_time: 3600 });

    const entity = toCyclingActivityEntityFromDetail(detail);

    expect(entity.id).toBe(42);
    expect(entity.name).toBe('テストライド');
    expect(entity.distanceMeters).toBe(12345.6);
    expect(entity.movingTimeSeconds).toBe(3600);
    expect(entity.startDate).toEqual(new Date('2026-07-01T00:00:00Z'));
  });

  test('polylineが設定されている場合、polyline（高解像度）からGeoJSON LineStringにデコードされる', () => {
    const detail = createActivityDetail({
      map: { summary_polyline: 'should-not-be-used', polyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' }
    });

    const entity = toCyclingActivityEntityFromDetail(detail);

    expect(entity.path).toEqual({
      type: 'LineString',
      coordinates: [
        [-120.2, 38.5],
        [-120.95, 40.7],
        [-126.453, 43.252]
      ]
    });
  });

  test('polylineが空文字だがsummary_polylineがある場合、summary_polylineにフォールバックする', () => {
    const detail = createActivityDetail({
      map: { summary_polyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@', polyline: '' }
    });

    const entity = toCyclingActivityEntityFromDetail(detail);

    expect(entity.path).toEqual({
      type: 'LineString',
      coordinates: [
        [-120.2, 38.5],
        [-120.95, 40.7],
        [-126.453, 43.252]
      ]
    });
  });

  test('polyline・summary_polylineの両方が空文字の場合、pathはnullになる（GPSルートの無い手動記録等）', () => {
    const detail = createActivityDetail({ map: { summary_polyline: '', polyline: '' } });

    const entity = toCyclingActivityEntityFromDetail(detail);

    expect(entity.path).toBeNull();
  });

  test('detailFetchedAtに現在時刻が設定される', () => {
    const before = new Date();
    const detail = createActivityDetail({});

    const entity = toCyclingActivityEntityFromDetail(detail);

    expect(entity.detailFetchedAt).not.toBeNull();
    expect((entity.detailFetchedAt as Date).getTime()).toBeGreaterThanOrEqual(before.getTime());
  });
});
