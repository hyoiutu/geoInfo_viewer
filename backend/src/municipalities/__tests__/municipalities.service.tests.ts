import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { describe, expect, test, vi } from 'vitest';
import { MunicipalityEntity } from '../entities/municipality.entity';
import { MunicipalitiesService } from '../municipalities.service';

describe('MunicipalitiesServiceに関するテスト', () => {
  const createService = async (query: ReturnType<typeof vi.fn>) => {
    const moduleRef = await Test.createTestingModule({
      providers: [MunicipalitiesService, { provide: getRepositoryToken(MunicipalityEntity), useValue: { query } }]
    }).compile();

    return moduleRef.get(MunicipalitiesService);
  };

  test('リポジトリのqueryが返した結果をそのまま返す', async () => {
    const rows = [
      { prefectureName: '東京都', municipalityName: '千代田区' },
      { prefectureName: '神奈川県', municipalityName: '横浜市中区' }
    ];
    const query = vi.fn().mockResolvedValue(rows);
    const service = await createService(query);

    const result = await service.findPassedMunicipalities('123');

    expect(result).toBe(rows);
  });

  test('対象アクティビティのIDとサンプリング間隔(100m)をクエリのパラメータに渡す', async () => {
    const query = vi.fn().mockResolvedValue([]);
    const service = await createService(query);

    await service.findPassedMunicipalities('123');

    expect(query).toHaveBeenCalledWith(expect.any(String), ['123', 100]);
  });

  test('該当する自治体が無い場合、空配列を返す', async () => {
    const query = vi.fn().mockResolvedValue([]);
    const service = await createService(query);

    const result = await service.findPassedMunicipalities('999');

    expect(result).toEqual([]);
  });
});
