import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { MunicipalityEntity } from '../entities/municipality.entity';
import { MunicipalitiesService } from '../municipalities.service';

describe('MunicipalitiesServiceに関するテスト', () => {
  let query: ReturnType<typeof vi.fn>;
  let find: ReturnType<typeof vi.fn>;

  const createService = async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [MunicipalitiesService, { provide: getRepositoryToken(MunicipalityEntity), useValue: { query, find } }]
    }).compile();

    return moduleRef.get(MunicipalitiesService);
  };

  beforeEach(() => {
    query = vi.fn().mockResolvedValue([]);
    find = vi.fn().mockResolvedValue([]);
  });

  describe('findPassedMunicipalities', () => {
    test('リポジトリのqueryが返した結果をそのまま返す', async () => {
      const rows = [
        { prefectureName: '東京都', municipalityName: '千代田区' },
        { prefectureName: '神奈川県', municipalityName: '横浜市中区' }
      ];
      query.mockResolvedValue(rows);
      const service = await createService();

      const result = await service.findPassedMunicipalities('123');

      expect(result).toBe(rows);
    });

    test('年代を指定しない場合、現行(current)・対象アクティビティのID・サンプリング間隔(100m)をクエリのパラメータに渡す', async () => {
      const service = await createService();

      await service.findPassedMunicipalities('123');

      expect(query).toHaveBeenCalledWith(expect.any(String), ['123', 100, 'current']);
    });

    test('年代を指定した場合、その年代をクエリのパラメータに渡す', async () => {
      const service = await createService();

      await service.findPassedMunicipalities('123', '2000-10-01');

      expect(query).toHaveBeenCalledWith(expect.any(String), ['123', 100, '2000-10-01']);
    });

    test('該当する自治体が無い場合、空配列を返す', async () => {
      const service = await createService();

      const result = await service.findPassedMunicipalities('999');

      expect(result).toEqual([]);
    });
  });

  describe('findBoundariesByEra', () => {
    test('指定した年代のMunicipalityEntityをGeoJSONのFeatureCollectionへ変換して返す', async () => {
      const geom = { type: 'MultiPolygon', coordinates: [] } as const;
      find.mockResolvedValue([
        Object.assign(new MunicipalityEntity(), {
          id: 1,
          era: '2000-10-01',
          prefectureName: '東京都',
          municipalityName: '千代田区',
          geom
        })
      ]);
      const service = await createService();

      const result = await service.findBoundariesByEra('2000-10-01');

      expect(result).toEqual({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: geom,
            properties: { prefectureName: '東京都', municipalityName: '千代田区' }
          }
        ]
      });
    });

    test('指定した年代でfindを絞り込む', async () => {
      const service = await createService();

      await service.findBoundariesByEra('current');

      expect(find).toHaveBeenCalledWith({ where: { era: 'current' } });
    });

    test('該当する自治体が無い場合、featuresが空のFeatureCollectionを返す', async () => {
      const service = await createService();

      const result = await service.findBoundariesByEra('current');

      expect(result).toEqual({ type: 'FeatureCollection', features: [] });
    });
  });
});
