import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { describe, expect, test, vi } from 'vitest';
import { MunicipalitiesController } from '../municipalities.controller';
import { MunicipalitiesService } from '../municipalities.service';

describe('MunicipalitiesControllerに関するテスト', () => {
  const createController = async (findBoundariesByEra: ReturnType<typeof vi.fn>) => {
    const moduleRef = await Test.createTestingModule({
      controllers: [MunicipalitiesController],
      providers: [{ provide: MunicipalitiesService, useValue: { findBoundariesByEra } }]
    }).compile();

    return moduleRef.get(MunicipalitiesController);
  };

  test('getBoundariesが呼ばれたとき、MunicipalitiesServiceのfindBoundariesByEraへ年代を渡しその戻り値をそのまま返す', async () => {
    const featureCollection = { type: 'FeatureCollection', features: [] } as const;
    const findBoundariesByEra = vi.fn().mockResolvedValue(featureCollection);
    const controller = await createController(findBoundariesByEra);

    const result = await controller.getBoundaries('2000-10-01');

    expect(findBoundariesByEra).toHaveBeenCalledWith('2000-10-01');
    expect(result).toBe(featureCollection);
  });

  test('eraを指定しない場合、現行(current)を渡す', async () => {
    const findBoundariesByEra = vi.fn().mockResolvedValue({ type: 'FeatureCollection', features: [] });
    const controller = await createController(findBoundariesByEra);

    await controller.getBoundaries(undefined);

    expect(findBoundariesByEra).toHaveBeenCalledWith('current');
  });

  test('不正な年代が指定された場合、BadRequestExceptionを投げる', async () => {
    const findBoundariesByEra = vi.fn();
    const controller = await createController(findBoundariesByEra);

    expect(() => controller.getBoundaries('1999-01-01')).toThrow(BadRequestException);
    expect(findBoundariesByEra).not.toHaveBeenCalled();
  });
});
