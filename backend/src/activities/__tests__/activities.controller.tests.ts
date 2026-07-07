import { Test } from '@nestjs/testing';
import { describe, expect, test, vi } from 'vitest';
import { ActivitiesController } from '../activities.controller';
import { ActivitiesService } from '../activities.service';
import type { CyclingActivityDto } from '../types/cycling-activity.dto';

describe('ActivitiesControllerに関するテスト', () => {
  test('findAllが呼ばれたとき、ActivitiesServiceのfindAllの戻り値をそのまま返す', async () => {
    const dtos: CyclingActivityDto[] = [
      {
        id: 1,
        name: 'ライド1',
        distanceMeters: 1000,
        movingTimeSeconds: 600,
        startDate: '2026-07-01T00:00:00Z',
        path: null
      }
    ];
    const findAll = vi.fn().mockResolvedValue(dtos);
    const moduleRef = await Test.createTestingModule({
      controllers: [ActivitiesController],
      providers: [{ provide: ActivitiesService, useValue: { findAll } }]
    }).compile();
    const controller = moduleRef.get(ActivitiesController);

    const result = await controller.findAll();

    expect(result).toBe(dtos);
  });
});
