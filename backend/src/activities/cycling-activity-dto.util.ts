import type { CyclingActivityEntity } from './entities/cycling-activity.entity';
import type { CyclingActivityDto } from './types/cycling-activity.dto';

/**
 * DBのEntityをフロントエンドへ返すDTOへ変換する
 * @param entity 変換元のEntity
 * @returns 変換後のDTO
 */
export const toCyclingActivityDto = (entity: CyclingActivityEntity): CyclingActivityDto => ({
  id: entity.id,
  name: entity.name,
  distanceMeters: entity.distanceMeters,
  movingTimeSeconds: entity.movingTimeSeconds,
  elapsedTimeSeconds: entity.elapsedTimeSeconds,
  elevationGainMeters: entity.elevationGainMeters,
  startDate: entity.startDate.toISOString(),
  path: entity.path === null ? null : (entity.path.coordinates as [number, number][])
});
