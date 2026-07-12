import { describe, expect, test } from 'vitest';
import type { CyclingActivity } from '../../api/activitiesApi';
import { toActivityDetailView } from '../activityDetailView';

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

describe('toActivityDetailViewに関するテスト', () => {
  test('アクティビティ名をそのまま表示用に返す', () => {
    const view = toActivityDetailView(createActivity({ name: '朝ライド' }));

    expect(view.name).toBe('朝ライド');
  });

  test('走行距離をkm単位・小数第1位で表示する', () => {
    const view = toActivityDetailView(createActivity({ distanceMeters: 12345 }));

    expect(view.distanceKm).toBe('12.3 km');
  });

  test('獲得標高を整数のm単位で表示する', () => {
    const view = toActivityDetailView(createActivity({ elevationGainMeters: 250.5 }));

    expect(view.elevationGainMeters).toBe('251 m');
  });

  test('平均時速を走行距離÷走行時間(movingTimeSeconds)からkm/h・小数第1位で算出する', () => {
    const view = toActivityDetailView(createActivity({ distanceMeters: 36000, movingTimeSeconds: 3600 }));

    expect(view.averageSpeedKmh).toBe('36.0 km/h');
  });

  test('走行時間が0の場合、ゼロ除算せず0.0 km/hを返す', () => {
    const view = toActivityDetailView(createActivity({ distanceMeters: 1000, movingTimeSeconds: 0 }));

    expect(view.averageSpeedKmh).toBe('0.0 km/h');
  });

  test('走行終了日時を開始日時+経過時間(elapsedTimeSeconds)から算出する', () => {
    const view = toActivityDetailView(
      createActivity({ startDate: '2026-07-01T01:00:00.000Z', elapsedTimeSeconds: 3900 })
    );

    expect(view.endDate).toBe(new Date('2026-07-01T02:05:00.000Z').toLocaleString('ja-JP'));
  });

  test('走行開始日時をロケール表示形式に変換する', () => {
    const view = toActivityDetailView(createActivity({ startDate: '2026-07-01T01:00:00.000Z' }));

    expect(view.startDate).toBe(new Date('2026-07-01T01:00:00.000Z').toLocaleString('ja-JP'));
  });
});
