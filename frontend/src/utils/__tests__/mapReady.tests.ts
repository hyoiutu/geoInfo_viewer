import type maplibregl from 'maplibre-gl';
import { describe, expect, test } from 'vitest';
import { getReadyMap } from '../mapReady';

// テスト対象はmapインスタンス自体を判定に使わずそのまま返すだけのため、実体を必要としないダミーオブジェクトへキャストする
const asMap = (mock: object): maplibregl.Map => mock as never;

describe('getReadyMapに関するテスト（PR #128レビュー対応）', () => {
  test('isStyleLoadedがtrueの場合、mapRef.currentをそのまま返す', () => {
    const map = asMap({});

    expect(getReadyMap({ current: map }, true)).toBe(map);
  });

  test('isStyleLoadedがfalseの場合、mapRef.currentがあってもnullを返す', () => {
    const map = asMap({});

    expect(getReadyMap({ current: map }, false)).toBeNull();
  });

  test('mapRef.currentがnullの場合、isStyleLoadedがtrueでもnullを返す', () => {
    expect(getReadyMap({ current: null }, true)).toBeNull();
  });
});
