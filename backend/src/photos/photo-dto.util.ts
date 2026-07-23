import type { PhotoEntity } from './entities/photo.entity';
import type { PhotoDto } from './types/photo.dto';

/**
 * DBのEntityをフロントエンドへ返すDTOへ変換する
 * @param entity 変換元のEntity
 * @returns 変換後のDTO
 */
export const toPhotoDto = (entity: PhotoEntity): PhotoDto => ({
  id: entity.id,
  fileName: entity.fileName,
  takenAt: entity.takenAt.toISOString(),
  location: entity.location
});
