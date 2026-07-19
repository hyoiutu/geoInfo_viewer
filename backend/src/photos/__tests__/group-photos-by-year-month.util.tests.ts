import { describe, expect, test } from 'vitest';
import { groupPhotosByYearMonth } from '../group-photos-by-year-month.util';
import type { TakeoutArchiveEntry } from '../takeout-archive.util';
import type { PhotoMetadata } from '../takeout-metadata.util';

const createEntry = (path: string): TakeoutArchiveEntry => ({ path, data: Buffer.from(path) });
const createMetadata = (takenAt: Date): PhotoMetadata => ({ takenAt, location: null });

describe('groupPhotosByYearMonthに関するテスト', () => {
  test('撮影日時(UTC)が同じ年月の写真を1つのグループにまとめる', () => {
    const photo1 = { entry: createEntry('a.jpg'), metadata: createMetadata(new Date('2026-07-01T00:00:00Z')) };
    const photo2 = { entry: createEntry('b.jpg'), metadata: createMetadata(new Date('2026-07-31T23:59:59Z')) };

    const result = groupPhotosByYearMonth([photo1, photo2]);

    expect(result).toEqual([{ yearMonth: '2026-07', photos: [photo1, photo2] }]);
  });

  test('撮影年月が異なる写真は別グループに分ける', () => {
    const photo1 = { entry: createEntry('a.jpg'), metadata: createMetadata(new Date('2026-07-15T00:00:00Z')) };
    const photo2 = { entry: createEntry('b.jpg'), metadata: createMetadata(new Date('2009-01-01T00:00:00Z')) };

    const result = groupPhotosByYearMonth([photo1, photo2]);

    expect(result).toEqual([
      { yearMonth: '2026-07', photos: [photo1] },
      { yearMonth: '2009-01', photos: [photo2] }
    ]);
  });

  test('月が1桁の場合はゼロパディングする', () => {
    const photo = { entry: createEntry('a.jpg'), metadata: createMetadata(new Date('2026-01-01T00:00:00Z')) };

    const result = groupPhotosByYearMonth([photo]);

    expect(result).toEqual([{ yearMonth: '2026-01', photos: [photo] }]);
  });

  test('空配列を渡した場合、空配列を返す', () => {
    const result = groupPhotosByYearMonth([]);

    expect(result).toEqual([]);
  });
});
