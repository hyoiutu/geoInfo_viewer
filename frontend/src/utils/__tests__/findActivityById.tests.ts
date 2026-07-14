import { describe, expect, test } from 'vitest';
import type { CyclingActivity } from '../../api/activitiesApi';
import { findActivityById } from '../findActivityById';

const createActivity = (id: string): CyclingActivity => ({
  id,
  name: `activity-${id}`,
  distanceMeters: 1000,
  startDate: '2026-01-01T00:00:00Z',
  movingTimeSeconds: 600,
  elapsedTimeSeconds: 600,
  elevationGainMeters: 10,
  path: null
});

describe('findActivityByIdに関するテスト', () => {
  test('idに一致するアクティビティを返す', () => {
    const activities = [createActivity('a'), createActivity('b')];

    expect(findActivityById(activities, 'b')).toBe(activities[1]);
  });

  test('idがnullの場合はnullを返す', () => {
    const activities = [createActivity('a')];

    expect(findActivityById(activities, null)).toBeNull();
  });

  test('一致するアクティビティが無い場合はnullを返す', () => {
    const activities = [createActivity('a')];

    expect(findActivityById(activities, 'not-found')).toBeNull();
  });
});
