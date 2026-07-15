// biome-ignore-all lint/style/useNamingConvention: Strava APIレスポンス形式(snake_case)に合わせたテストダブル

import polyline from '@mapbox/polyline';
import { describe, expect, test } from 'vitest';
import type { StravaActivity, StravaActivityDetail } from '../../strava/types/strava-activity.type';
import { toCyclingActivityEntityFromDetail, toPlaceholderCyclingActivityEntity } from '../cycling-activity-entity.util';

// polyline.encodeは[緯度, 経度]の順で受け取る
const CLOSE_POINTS_POLYLINE = polyline.encode([
  [35.681, 139.767],
  [35.6812, 139.7672]
]);

const createActivity = (overrides: Partial<StravaActivity>): StravaActivity => ({
  id: 42,
  name: 'テストライド',
  type: 'Ride',
  distance: 12345.6,
  moving_time: 3600,
  elapsed_time: 3900,
  total_elevation_gain: 250.5,
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
  elapsed_time: 3900,
  total_elevation_gain: 250.5,
  start_date: '2026-07-01T00:00:00Z',
  map: { summary_polyline: '', polyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' },
  ...overrides
});

describe('toPlaceholderCyclingActivityEntityに関するテスト', () => {
  test('StravaActivityの基本フィールドがEntityへマッピングされる', () => {
    const activity = createActivity({ id: 42, name: 'テストライド', distance: 12345.6, moving_time: 3600 });

    const entity = toPlaceholderCyclingActivityEntity(activity);

    expect(entity.id).toBe('42');
    expect(entity.name).toBe('テストライド');
    expect(entity.distanceMeters).toBe(12345.6);
    expect(entity.movingTimeSeconds).toBe(3600);
    expect(entity.elapsedTimeSeconds).toBe(3900);
    expect(entity.elevationGainMeters).toBe(250.5);
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

    expect(entity.id).toBe('42');
    expect(entity.name).toBe('テストライド');
    expect(entity.distanceMeters).toBe(12345.6);
    expect(entity.movingTimeSeconds).toBe(3600);
    expect(entity.elapsedTimeSeconds).toBe(3900);
    expect(entity.elevationGainMeters).toBe(250.5);
    expect(entity.startDate).toEqual(new Date('2026-07-01T00:00:00Z'));
  });

  test('polylineが設定されている場合、polyline（高解像度）からGeoJSON MultiLineStringにデコードされる', () => {
    const detail = createActivityDetail({
      map: { summary_polyline: 'should-not-be-used', polyline: CLOSE_POINTS_POLYLINE }
    });

    const entity = toCyclingActivityEntityFromDetail(detail);

    expect(entity.path).toEqual({
      type: 'MultiLineString',
      coordinates: [
        [
          [139.767, 35.681],
          [139.7672, 35.6812]
        ]
      ]
    });
  });

  test('polylineが空文字だがsummary_polylineがある場合、summary_polylineにフォールバックする', () => {
    const detail = createActivityDetail({
      map: { summary_polyline: CLOSE_POINTS_POLYLINE, polyline: '' }
    });

    const entity = toCyclingActivityEntityFromDetail(detail);

    expect(entity.path).toEqual({
      type: 'MultiLineString',
      coordinates: [
        [
          [139.767, 35.681],
          [139.7672, 35.6812]
        ]
      ]
    });
  });

  test('polyline・summary_polylineの両方が空文字の場合、pathはnullになる（GPSルートの無い手動記録等）', () => {
    const detail = createActivityDetail({ map: { summary_polyline: '', polyline: '' } });

    const entity = toCyclingActivityEntityFromDetail(detail);

    expect(entity.path).toBeNull();
  });

  test('隣接する2点間が10km以上離れている場合、位置飛びとして区間分割される（末尾の孤立した1点は除外される）', () => {
    // 東京(35.681, 139.767)の近傍2点の後、大きく離れた1点(北海道近辺)へジャンプする軌跡
    const encoded = polyline.encode([
      [35.681, 139.767],
      [35.6812, 139.7672],
      [43.062, 141.354]
    ]);
    const detail = createActivityDetail({ map: { summary_polyline: '', polyline: encoded } });

    const entity = toCyclingActivityEntityFromDetail(detail);

    expect(entity.path).toEqual({
      type: 'MultiLineString',
      coordinates: [
        [
          [139.767, 35.681],
          [139.7672, 35.6812]
        ]
      ]
    });
  });

  test('分割後に区間が1つも残らない場合(全ての隣接点が位置飛び)、pathはnullになる', () => {
    const detail = createActivityDetail({
      map: { summary_polyline: '', polyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' }
    });

    const entity = toCyclingActivityEntityFromDetail(detail);

    expect(entity.path).toBeNull();
  });

  test('detailFetchedAtに現在時刻が設定される', () => {
    const before = new Date();
    const detail = createActivityDetail({});

    const entity = toCyclingActivityEntityFromDetail(detail);

    if (entity.detailFetchedAt === null) {
      throw new Error('detailFetchedAtがnullです');
    }
    expect(entity.detailFetchedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });
});
