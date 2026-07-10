import { Test } from '@nestjs/testing';
import { describe, expect, test, vi } from 'vitest';
import { ActivitiesController } from '../activities.controller';
import { ActivitiesService } from '../activities.service';
import type { BackfillStartResult, BackfillStatus } from '../activities-backfill.service';
import { ActivitiesBackfillService } from '../activities-backfill.service';
import type { CyclingActivityDto } from '../types/cycling-activity.dto';

describe('ActivitiesControllerに関するテスト', () => {
  test('findAllが呼ばれたとき、ActivitiesServiceのfindAllの戻り値をそのまま返す', async () => {
    const dtos: CyclingActivityDto[] = [
      {
        id: '1',
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
      providers: [
        { provide: ActivitiesService, useValue: { findAll } },
        { provide: ActivitiesBackfillService, useValue: {} }
      ]
    }).compile();
    const controller = moduleRef.get(ActivitiesController);

    const result = await controller.findAll();

    expect(result).toBe(dtos);
  });

  test('syncが呼ばれたとき、ActivitiesServiceのsyncの戻り値をそのまま返す', async () => {
    const syncResult = { success: true };
    const sync = vi.fn().mockResolvedValue(syncResult);
    const moduleRef = await Test.createTestingModule({
      controllers: [ActivitiesController],
      providers: [
        { provide: ActivitiesService, useValue: { sync } },
        { provide: ActivitiesBackfillService, useValue: {} }
      ]
    }).compile();
    const controller = moduleRef.get(ActivitiesController);

    const result = await controller.sync();

    expect(result).toBe(syncResult);
  });

  test('startBackfillが呼ばれたとき、ActivitiesBackfillServiceのstartの戻り値をそのまま返す', async () => {
    const startResult: BackfillStartResult = { started: true };
    const start = vi.fn().mockResolvedValue(startResult);
    const moduleRef = await Test.createTestingModule({
      controllers: [ActivitiesController],
      providers: [
        { provide: ActivitiesService, useValue: {} },
        { provide: ActivitiesBackfillService, useValue: { start } }
      ]
    }).compile();
    const controller = moduleRef.get(ActivitiesController);

    const result = await controller.startBackfill();

    expect(result).toBe(startResult);
  });

  test('getBackfillStatusが呼ばれたとき、ActivitiesBackfillServiceのgetStatusの戻り値をそのまま返す', async () => {
    const status: BackfillStatus = {
      isRunning: true,
      totalCount: 4,
      completedCount: 1,
      progressPercent: 25,
      estimatedRemainingSeconds: 27
    };
    const getStatus = vi.fn().mockResolvedValue(status);
    const moduleRef = await Test.createTestingModule({
      controllers: [ActivitiesController],
      providers: [
        { provide: ActivitiesService, useValue: {} },
        { provide: ActivitiesBackfillService, useValue: { getStatus } }
      ]
    }).compile();
    const controller = moduleRef.get(ActivitiesController);

    const result = await controller.getBackfillStatus();

    expect(result).toBe(status);
  });
});
