import { describe, expect, test } from 'vitest';
import { splitPhotosIntoSizedParts } from '../split-photos-into-sized-parts.util';

describe('splitPhotosIntoSizedPartsに関するテスト', () => {
  test('合計サイズが上限以下の場合、1つのpartにまとめる', () => {
    const photos = ['a', 'b', 'c'];

    const result = splitPhotosIntoSizedParts(photos, () => 10, 100);

    expect(result).toEqual([['a', 'b', 'c']]);
  });

  test('累積サイズが上限を超える直前で新しいpartへ分割する', () => {
    const photos = ['a', 'b', 'c', 'd'];
    const sizeOf = (photo: string): number => (photo === 'c' ? 40 : 30);

    // a(30)+b(30)=60、+c(40)=100は上限(100)を超えないため同一part。+d(30)=130は超えるため新partへ
    const result = splitPhotosIntoSizedParts(photos, sizeOf, 100);

    expect(result).toEqual([['a', 'b', 'c'], ['d']]);
  });

  test('1件だけで上限を超えるサイズの写真も、それ単独で1つのpartとする', () => {
    const photos = ['huge'];

    const result = splitPhotosIntoSizedParts(photos, () => 1000, 100);

    expect(result).toEqual([['huge']]);
  });

  test('上限超えの巨大な写真の直後に続く写真は、別の新しいpartへ入れる', () => {
    const photos = ['huge', 'normal'];
    const sizeOf = (photo: string): number => (photo === 'huge' ? 1000 : 10);

    const result = splitPhotosIntoSizedParts(photos, sizeOf, 100);

    expect(result).toEqual([['huge'], ['normal']]);
  });

  test('写真が0件の場合、空配列を返す', () => {
    const result = splitPhotosIntoSizedParts([], () => 10, 100);

    expect(result).toEqual([]);
  });
});
