import type { Position } from 'geojson';
import type { CyclingActivityEntity } from './entities/cycling-activity.entity';
import type { CyclingActivityDto } from './types/cycling-activity.dto';

/**
 * GeoJSONのPosition（`number[]`、高度等の追加要素を含みうる）から、経度・緯度の2要素タプルを取り出す
 * @param position 変換元のPosition
 * @returns [経度, 緯度]の2要素タプル
 */
const toLngLat = (position: Position): [number, number] => [position[0], position[1]];

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
  path: entity.path === null ? null : entity.path.coordinates.map((line) => line.map(toLngLat))
});
