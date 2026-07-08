import type { CyclingActivityEntity } from './entities/cycling-activity.entity';
import type { CyclingActivityDto } from './types/cycling-activity.dto';

export const toCyclingActivityDto = (entity: CyclingActivityEntity): CyclingActivityDto => ({
  id: entity.id,
  name: entity.name,
  distanceMeters: entity.distanceMeters,
  movingTimeSeconds: entity.movingTimeSeconds,
  startDate: entity.startDate.toISOString(),
  path: entity.path === null ? null : (entity.path.coordinates as [number, number][])
});
