import { describe, expect, test } from 'vitest';
import type { CyclingActivity } from '../../api/activitiesApi';
import { cyclingActivityToGeoJson } from '../cyclingActivityToGeoJson';

describe('cyclingActivityToGeoJsonに関するテスト', () => {
  test('pathを持つアクティビティは、LineString FeatureのFeatureCollectionに変換される', () => {
    const activities: CyclingActivity[] = [
      {
        id: 1,
        name: 'ライド1',
        distanceMeters: 1000,
        movingTimeSeconds: 600,
        startDate: '2026-07-01T00:00:00Z',
        path: [
          [139.767125, 35.681236],
          [139.768, 35.6813]
        ]
      }
    ];

    const geoJson = cyclingActivityToGeoJson(activities);

    expect(geoJson).toEqual({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { id: 1, name: 'ライド1' },
          geometry: {
            type: 'LineString',
            coordinates: [
              [139.767125, 35.681236],
              [139.768, 35.6813]
            ]
          }
        }
      ]
    });
  });

  test('pathがnullのアクティビティは、FeatureCollectionから除外される', () => {
    const activities: CyclingActivity[] = [
      {
        id: 1,
        name: 'GPSデータなし',
        distanceMeters: 0,
        movingTimeSeconds: 0,
        startDate: '2026-07-01T00:00:00Z',
        path: null
      }
    ];

    const geoJson = cyclingActivityToGeoJson(activities);

    expect(geoJson.features).toEqual([]);
  });
});
