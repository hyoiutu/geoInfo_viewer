// biome-ignore-all lint/style/useNamingConvention: Strava APIレスポンス形式(snake_case)に合わせたテストダブル
import { HttpService } from '@nestjs/axios';
import { Test } from '@nestjs/testing';
import { of } from 'rxjs';
import { describe, expect, test, vi } from 'vitest';
import { StravaActivitiesService } from '../strava-activities.service';
import { StravaAuthService } from '../strava-auth.service';
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

describe('StravaActivitiesServiceに関するテスト', () => {
  const createService = async (httpServiceGet: ReturnType<typeof vi.fn>) => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        StravaActivitiesService,
        { provide: HttpService, useValue: { get: httpServiceGet } },
        { provide: StravaAuthService, useValue: { getAccessToken: vi.fn().mockResolvedValue('token-xyz') } }
      ]
    }).compile();

    return moduleRef.get(StravaActivitiesService);
  };

  test('fetchCyclingActivitiesが呼ばれたとき、Ride/VirtualRide以外のアクティビティは除外される', async () => {
    const httpServiceGet = vi.fn().mockReturnValue(
      of({
        data: [
          createActivity({ id: 1, type: 'Ride' }),
          createActivity({ id: 2, type: 'Run' }),
          createActivity({ id: 3, type: 'VirtualRide' })
        ]
      })
    );
    const service = await createService(httpServiceGet);

    const activities = await service.fetchCyclingActivities();

    expect(activities.map((activity) => activity.id)).toEqual([1, 3]);
  });

  test('fetchCyclingActivitiesが呼ばれたとき、アクセストークンをAuthorizationヘッダーに含める', async () => {
    const httpServiceGet = vi.fn().mockReturnValue(of({ data: [] }));
    const service = await createService(httpServiceGet);

    await service.fetchCyclingActivities();

    expect(httpServiceGet).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ headers: { Authorization: 'Bearer token-xyz' } })
    );
  });
});
