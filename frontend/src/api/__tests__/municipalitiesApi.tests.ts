import { afterEach, describe, expect, test, vi } from 'vitest';
import { ApiError } from '../../utils/apiError';
import { fetchMunicipalityBoundaries } from '../municipalitiesApi';

describe('fetchMunicipalityBoundariesに関するテスト', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('GETでmunicipalities/boundariesエンドポイントを年代付きで呼び出し、レスポンスをそのまま返す', async () => {
    const featureCollection = { type: 'FeatureCollection', features: [] };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(featureCollection)
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchMunicipalityBoundaries('2000-10-01');

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3000/municipalities/boundaries?era=2000-10-01');
    expect(result).toEqual(featureCollection);
  });

  test('レスポンスが異常なとき、ApiErrorを投げる', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, json: () => Promise.reject(new Error()) });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchMunicipalityBoundaries('2000-10-01')).rejects.toBeInstanceOf(ApiError);
  });
});
