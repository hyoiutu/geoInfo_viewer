import { describe, expect, test } from 'vitest';
import { toCyclingActivityDto } from '../cycling-activity-dto.util';
import { CyclingActivityEntity } from '../entities/cycling-activity.entity';

const createEntity = (overrides: Partial<CyclingActivityEntity>): CyclingActivityEntity => {
  const entity = new CyclingActivityEntity();
  entity.id = '42';
  entity.name = 'テストライド';
  entity.distanceMeters = 12345.6;
  entity.movingTimeSeconds = 3600;
  entity.elapsedTimeSeconds = 3900;
  entity.elevationGainMeters = 250.5;
  entity.startDate = new Date('2026-07-01T00:00:00Z');
  entity.path = null;
  Object.assign(entity, overrides);
  return entity;
};

describe('toCyclingActivityDtoに関するテスト', () => {
  test('CyclingActivityEntityのフィールドがDTOへ正しくマッピングされる', () => {
    const entity = createEntity({ id: '42', name: 'テストライド', distanceMeters: 12345.6, movingTimeSeconds: 3600 });

    const dto = toCyclingActivityDto(entity);

    expect(dto.id).toBe('42');
    expect(dto.name).toBe('テストライド');
    expect(dto.distanceMeters).toBe(12345.6);
    expect(dto.movingTimeSeconds).toBe(3600);
    expect(dto.elapsedTimeSeconds).toBe(3900);
    expect(dto.elevationGainMeters).toBe(250.5);
    expect(dto.startDate).toBe('2026-07-01T00:00:00.000Z');
  });

  test('pathが設定されている場合、[lng, lat]順の座標配列に変換される', () => {
    const entity = createEntity({
      path: {
        type: 'LineString',
        coordinates: [
          [-120.2, 38.5],
          [-120.95, 40.7]
        ]
      }
    });

    const dto = toCyclingActivityDto(entity);

    expect(dto.path).toEqual([
      [-120.2, 38.5],
      [-120.95, 40.7]
    ]);
  });

  test('pathがnullのとき、pathはnullになる', () => {
    const entity = createEntity({ path: null });

    const dto = toCyclingActivityDto(entity);

    expect(dto.path).toBeNull();
  });
});
