import { describe, expect, test } from 'vitest';
import type { PhotoWithMetadata } from '../group-photos-by-year-month.util';
import { sortPhotosByTakenAt } from '../sort-photos-by-taken-at.util';

const createPhoto = (path: string, takenAt: string): PhotoWithMetadata => ({
  entry: { path, data: Buffer.alloc(0) },
  metadata: { takenAt: new Date(takenAt), location: null }
});

describe('sortPhotosByTakenAtに関するテスト', () => {
  test('撮影日時の昇順に並び替える', () => {
    const photos = [
      createPhoto('c.jpg', '2026-01-03T00:00:00Z'),
      createPhoto('a.jpg', '2026-01-01T00:00:00Z'),
      createPhoto('b.jpg', '2026-01-02T00:00:00Z')
    ];

    const result = sortPhotosByTakenAt(photos);

    expect(result.map((photo) => photo.entry.path)).toEqual(['a.jpg', 'b.jpg', 'c.jpg']);
  });

  test('元の配列は変更しない', () => {
    const photos = [createPhoto('b.jpg', '2026-01-02T00:00:00Z'), createPhoto('a.jpg', '2026-01-01T00:00:00Z')];

    sortPhotosByTakenAt(photos);

    expect(photos.map((photo) => photo.entry.path)).toEqual(['b.jpg', 'a.jpg']);
  });

  test('撮影日時が同一の場合、元の並び順を保つ（安定ソート）', () => {
    const sameTakenAt = '2026-01-01T00:00:00Z';
    const photos = [createPhoto('first.jpg', sameTakenAt), createPhoto('second.jpg', sameTakenAt)];

    const result = sortPhotosByTakenAt(photos);

    expect(result.map((photo) => photo.entry.path)).toEqual(['first.jpg', 'second.jpg']);
  });

  test('写真が0件の場合、空配列を返す', () => {
    const result = sortPhotosByTakenAt([]);

    expect(result).toEqual([]);
  });
});
