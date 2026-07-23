import { describe, expect, test } from 'vitest';
import { findDistanceAlongPathAtPoint } from '../findDistanceAlongPathAtPoint';

const EARTH_RADIUS_METERS = 6371000;
const DEGREES_TO_RADIANS = Math.PI / 180;

// 同一経度の2点間の大圏距離は、緯度差(ラジアン)×地球半径に厳密に一致する（Haversine公式がこの場合に厳密に簡約されるため）。
// テスト対象とは独立した計算式のため、期待値の検証として意味を持つ
const meridianDistanceMeters = (latDiffDegrees: number): number =>
  Math.abs(latDiffDegrees) * DEGREES_TO_RADIANS * EARTH_RADIUS_METERS;

describe('findDistanceAlongPathAtPointに関するテスト', () => {
  test('pathが空配列の場合、nullを返す', () => {
    const result = findDistanceAlongPathAtPoint([], [139.0, 35.0]);

    expect(result).toBeNull();
  });

  test('単一区間・始点ちょうどの場合、距離0を返す', () => {
    const path: [number, number][][] = [
      [
        [139.0, 35.0],
        [139.0, 35.01]
      ]
    ];

    const result = findDistanceAlongPathAtPoint(path, [139.0, 35.0]);

    expect(result).toBeCloseTo(0, 3);
  });

  test('単一区間・終点ちょうどの場合、区間全体の距離を返す', () => {
    const path: [number, number][][] = [
      [
        [139.0, 35.0],
        [139.0, 35.01]
      ]
    ];

    const result = findDistanceAlongPathAtPoint(path, [139.0, 35.01]);

    expect(result).toBeCloseTo(meridianDistanceMeters(0.01), 3);
  });

  test('単一区間・中点ちょうどの場合、区間全体の半分の距離を返す', () => {
    const path: [number, number][][] = [
      [
        [139.0, 35.0],
        [139.0, 35.01]
      ]
    ];

    const result = findDistanceAlongPathAtPoint(path, [139.0, 35.005]);

    expect(result).toBeCloseTo(meridianDistanceMeters(0.01) / 2, 3);
  });

  test('線からずれた地点をクリックした場合、最も近い区間上の点へ投影した距離を返す（区間に垂直なずれは投影距離に影響しない）', () => {
    const path: [number, number][][] = [
      [
        [139.0, 35.0],
        [139.0, 35.01]
      ]
    ];

    // 区間中点と同じ緯度・経度だけ東へずれた地点。区間が南北方向(経度一定)のため、
    // 東西方向のずれは区間上への投影結果(緯度方向の位置)に影響しない
    const result = findDistanceAlongPathAtPoint(path, [139.005, 35.005]);

    expect(result).toBeCloseTo(meridianDistanceMeters(0.01) / 2, 3);
  });

  test('複数区間（同一グループ内）の場合、手前の区間の距離を加算する', () => {
    const path: [number, number][][] = [
      [
        [139.0, 35.0],
        [139.0, 35.01],
        [139.0, 35.03]
      ]
    ];

    // 2番目の区間(35.01→35.03)の中点
    const result = findDistanceAlongPathAtPoint(path, [139.0, 35.02]);

    expect(result).toBeCloseTo(meridianDistanceMeters(0.01) + meridianDistanceMeters(0.01), 3);
  });

  test('位置飛びで分割された複数グループの場合、グループ間のジャンプ分は加算せず手前のグループの距離のみ加算する', () => {
    const path: [number, number][][] = [
      [
        [139.0, 35.0],
        [139.0, 35.01]
      ],
      // 大きく離れたグループ(位置飛び後の区間)
      [
        [140.0, 36.0],
        [140.0, 36.01]
      ]
    ];

    // 2グループ目の始点ちょうど
    const result = findDistanceAlongPathAtPoint(path, [140.0, 36.0]);

    expect(result).toBeCloseTo(meridianDistanceMeters(0.01), 3);
  });

  test('2点未満の区間グループ（孤立点）は無視して次のグループを評価する', () => {
    const path: [number, number][][] = [
      [[139.0, 35.0]],
      [
        [140.0, 36.0],
        [140.0, 36.01]
      ]
    ];

    const result = findDistanceAlongPathAtPoint(path, [140.0, 36.0]);

    expect(result).toBeCloseTo(0, 3);
  });
});
