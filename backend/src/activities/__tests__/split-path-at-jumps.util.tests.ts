import { describe, expect, test } from 'vitest';
import { splitPathAtJumps } from '../split-path-at-jumps.util';

// 赤道付近では経度1度あたり約111km。0.001度(約111m)は10km未満、1度(約111km)は10km以上の差になる
const CLOSE_LNG_DELTA = 0.001;
const FAR_LNG_DELTA = 1;

describe('splitPathAtJumpsに関するテスト', () => {
  test('空の軌跡の場合、空配列を返す', () => {
    expect(splitPathAtJumps([])).toEqual([]);
  });

  test('1点のみの軌跡の場合、線を描画できないため空配列を返す', () => {
    expect(splitPathAtJumps([[0, 0]])).toEqual([]);
  });

  test('全ての隣接点が10km未満の場合、分割せず1つの区間として返す', () => {
    const path: [number, number][] = [
      [0, 0],
      [CLOSE_LNG_DELTA, 0],
      [CLOSE_LNG_DELTA * 2, 0]
    ];

    expect(splitPathAtJumps(path)).toEqual([path]);
  });

  test('隣接する2点が10km以上離れている場合、そこで区間を分割する', () => {
    const pointA: [number, number] = [0, 0];
    const pointB: [number, number] = [CLOSE_LNG_DELTA, 0];
    const pointC: [number, number] = [CLOSE_LNG_DELTA + FAR_LNG_DELTA, 0];
    const pointD: [number, number] = [CLOSE_LNG_DELTA * 2 + FAR_LNG_DELTA, 0];

    const result = splitPathAtJumps([pointA, pointB, pointC, pointD]);

    expect(result).toEqual([
      [pointA, pointB],
      [pointC, pointD]
    ]);
  });

  test('分割した結果2点未満(孤立した1点)になる区間は除外する', () => {
    const isolatedPoint: [number, number] = [FAR_LNG_DELTA, 0];
    const pointA: [number, number] = [0, 0];
    const pointC: [number, number] = [FAR_LNG_DELTA * 2, 0];
    const pointD: [number, number] = [FAR_LNG_DELTA * 2 + CLOSE_LNG_DELTA, 0];

    // pointA(単独) - 大ジャンプ - isolatedPoint(単独) - 大ジャンプ - pointC,pointD(区間として成立)
    const result = splitPathAtJumps([pointA, isolatedPoint, pointC, pointD]);

    expect(result).toEqual([[pointC, pointD]]);
  });

  test('全ての区間が孤立した1点になる場合、空配列を返す', () => {
    const pointA: [number, number] = [0, 0];
    const pointB: [number, number] = [FAR_LNG_DELTA, 0];
    const pointC: [number, number] = [FAR_LNG_DELTA * 2, 0];

    expect(splitPathAtJumps([pointA, pointB, pointC])).toEqual([]);
  });
});
