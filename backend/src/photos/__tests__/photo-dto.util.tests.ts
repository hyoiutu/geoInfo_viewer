import { describe, expect, test } from 'vitest';
import type { PhotoEntity } from '../entities/photo.entity';
import { toPhotoDto } from '../photo-dto.util';

describe('toPhotoDtoに関するテスト', () => {
  test('位置情報を持つ写真Entityを、そのままDTOへ変換する', () => {
    const takenAt = new Date('2026-07-01T00:30:00.000Z');
    const entity: PhotoEntity = {
      id: 1,
      fileName: 'IMG_1.jpg',
      takenAt,
      location: { type: 'Point', coordinates: [139.7, 35.6] },
      sourceFileId: 'file-1',
      archivePath: 'IMG_1.jpg'
    };

    const result = toPhotoDto(entity);

    expect(result).toEqual({
      id: 1,
      fileName: 'IMG_1.jpg',
      takenAt: takenAt.toISOString(),
      location: { type: 'Point', coordinates: [139.7, 35.6] }
    });
  });

  test('位置情報を持たない写真Entityは、locationがnullのDTOへ変換する', () => {
    const takenAt = new Date('2026-07-01T00:30:00.000Z');
    const entity: PhotoEntity = {
      id: 2,
      fileName: 'IMG_2.jpg',
      takenAt,
      location: null,
      sourceFileId: 'file-1',
      archivePath: 'IMG_2.jpg'
    };

    const result = toPhotoDto(entity);

    expect(result.location).toBeNull();
  });
});
