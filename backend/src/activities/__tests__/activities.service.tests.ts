// biome-ignore-all lint/style/useNamingConvention: Strava APIレスポンス形式(snake_case)に合わせたテストダブル
import { Test } from '@nestjs/testing';
import { describe, expect, test, vi } from 'vitest';
import { StravaActivitiesService } from '../../strava/strava-activities.service';
import type { StravaActivity } from '../../strava/types/strava-activity.type';
import { ActivitiesService } from '../activities.service';

const createActivity = (overrides: Partial<StravaActivity>): StravaActivity => ({
  id: 1,
  name: 'テストライド',
  type: 'Ride',
  distance: 1000,
  moving_time: 600,
  start_date: '2026-07-01T00:00:00Z',
  map: { summary_polyline: '' },
  ...overrides
});

describe('ActivitiesServiceに関するテスト', () => {
  test('findAllが呼ばれたとき、StravaActivitiesServiceから取得したアクティビティをDTOへ変換して返す', async () => {
    const fetchCyclingActivities = vi
      .fn()
      .mockResolvedValue([createActivity({ id: 1, name: 'ライド1' }), createActivity({ id: 2, name: 'ライド2' })]);
    const moduleRef = await Test.createTestingModule({
      providers: [ActivitiesService, { provide: StravaActivitiesService, useValue: { fetchCyclingActivities } }]
    }).compile();
    const service = moduleRef.get(ActivitiesService);

    const result = await service.findAll();

    expect(result).toEqual([
      expect.objectContaining({ id: 1, name: 'ライド1' }),
      expect.objectContaining({ id: 2, name: 'ライド2' })
    ]);
  });
});
