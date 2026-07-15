import { describe, expect, test } from 'vitest';
import type { CyclingActivity } from '../../api/activitiesApi';
import { cyclingActivityToGeoJson } from '../cyclingActivityToGeoJson';

describe('cyclingActivityToGeoJsonに関するテスト', () => {
  test('pathを持つアクティビティは、MultiLineString FeatureのFeatureCollectionに変換される', () => {
    const activities: CyclingActivity[] = [
      {
        id: '1',
        name: 'ライド1',
        distanceMeters: 1000,
        movingTimeSeconds: 600,
        elapsedTimeSeconds: 650,
        elevationGainMeters: 50,
        startDate: '2026-07-01T00:00:00Z',
        path: [
          [
            [139.767125, 35.681236],
            [139.768, 35.6813]
          ]
        ]
      }
    ];

    const geoJson = cyclingActivityToGeoJson(activities);

    expect(geoJson).toEqual({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { id: '1', name: 'ライド1' },
          geometry: {
            type: 'MultiLineString',
            coordinates: [
              [
                [139.767125, 35.681236],
                [139.768, 35.6813]
              ]
            ]
          }
        }
      ]
    });
  });

  test('位置飛びで区間分割されたpath（複数の区間）は、複数のLineStringを持つMultiLineStringに変換される', () => {
    const activities: CyclingActivity[] = [
      {
        id: '1',
        name: 'ライド1',
        distanceMeters: 1000,
        movingTimeSeconds: 600,
        elapsedTimeSeconds: 650,
        elevationGainMeters: 50,
        startDate: '2026-07-01T00:00:00Z',
        path: [
          [
            [139.767125, 35.681236],
            [139.768, 35.6813]
          ],
          [
            [140.0, 36.0],
            [140.001, 36.001]
          ]
        ]
      }
    ];

    const geoJson = cyclingActivityToGeoJson(activities);

    expect(geoJson.features[0].geometry.coordinates).toHaveLength(2);
  });

  test('pathがnullのアクティビティは、FeatureCollectionから除外される', () => {
    const activities: CyclingActivity[] = [
      {
        id: '1',
        name: 'GPSデータなし',
        distanceMeters: 0,
        movingTimeSeconds: 0,
        elapsedTimeSeconds: 0,
        elevationGainMeters: 0,
        startDate: '2026-07-01T00:00:00Z',
        path: null
      }
    ];

    const geoJson = cyclingActivityToGeoJson(activities);

    expect(geoJson.features).toEqual([]);
  });
});
