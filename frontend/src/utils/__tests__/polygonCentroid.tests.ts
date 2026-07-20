import type { MultiPolygon, Polygon } from 'geojson';
import { describe, expect, test } from 'vitest';
import { calculatePolygonCentroid } from '../polygonCentroid';

describe('calculatePolygonCentroidに関するテスト', () => {
  test('正方形のPolygonの場合、幾何中心を返す', () => {
    const square: Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [2, 0],
          [2, 2],
          [0, 2],
          [0, 0]
        ]
      ]
    };

    const centroid = calculatePolygonCentroid(square);

    expect(centroid?.[0]).toBeCloseTo(1, 6);
    expect(centroid?.[1]).toBeCloseTo(1, 6);
  });

  test('穴(内側のリング)を持つPolygonの場合、外側のリングのみで重心を算出する', () => {
    const squareWithHole: Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [2, 0],
          [2, 2],
          [0, 2],
          [0, 0]
        ],
        [
          [0.9, 0.9],
          [1.1, 0.9],
          [1.1, 1.1],
          [0.9, 1.1],
          [0.9, 0.9]
        ]
      ]
    };

    const centroid = calculatePolygonCentroid(squareWithHole);

    expect(centroid?.[0]).toBeCloseTo(1, 6);
    expect(centroid?.[1]).toBeCloseTo(1, 6);
  });

  test('MultiPolygonの場合、各ポリゴンの面積で重み付けした重心を返す', () => {
    // 面積4の正方形(中心[1,1])と面積1の正方形(中心[10.5,10.5])。面積比4:1で重み付けした重心を期待する
    const multiPolygon: MultiPolygon = {
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [0, 0],
            [2, 0],
            [2, 2],
            [0, 2],
            [0, 0]
          ]
        ],
        [
          [
            [10, 10],
            [11, 10],
            [11, 11],
            [10, 11],
            [10, 10]
          ]
        ]
      ]
    };

    const centroid = calculatePolygonCentroid(multiPolygon);

    const expectedX = (1 * 4 + 10.5 * 1) / 5;
    const expectedY = (1 * 4 + 10.5 * 1) / 5;
    expect(centroid?.[0]).toBeCloseTo(expectedX, 6);
    expect(centroid?.[1]).toBeCloseTo(expectedY, 6);
  });

  test('座標の頂点順が時計回りでも、正しい向きの面積として重心を算出する', () => {
    const clockwiseSquare: Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [0, 2],
          [2, 2],
          [2, 0],
          [0, 0]
        ]
      ]
    };

    const centroid = calculatePolygonCentroid(clockwiseSquare);

    expect(centroid?.[0]).toBeCloseTo(1, 6);
    expect(centroid?.[1]).toBeCloseTo(1, 6);
  });

  test('全ての面積が0(縮退したジオメトリ)の場合、nullを返す', () => {
    const degenerate: Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [0, 0]
        ]
      ]
    };

    const centroid = calculatePolygonCentroid(degenerate);

    expect(centroid).toBeNull();
  });
});
