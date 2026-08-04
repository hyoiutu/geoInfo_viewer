import { renderHook, waitFor } from '@testing-library/react';
import { Provider as JotaiProvider, useAtomValue } from 'jotai';
import type maplibregl from 'maplibre-gl';
import { describe, expect, test, vi } from 'vitest';
import { errorsAtom } from '../../atoms/errorsAtom';
import * as mapLayerInteraction from '../../utils/mapLayerInteraction';
import * as mapLayerSetup from '../../utils/mapLayerSetup';
import { useAdminBoundaryData } from '../useAdminBoundaryData';

const EMPTY_FEATURE_COLLECTION = { type: 'FeatureCollection' as const, features: [] };

/** useAdminBoundaryDataとerrorsAtomの現在値を合わせて返す、テスト用の合成フック */
const useAdminBoundaryDataWithErrors = (...args: Parameters<typeof useAdminBoundaryData>) => {
  useAdminBoundaryData(...args);
  return { errors: useAtomValue(errorsAtom) };
};

const renderWithProvider = (...args: Parameters<typeof useAdminBoundaryData>) =>
  renderHook(() => useAdminBoundaryDataWithErrors(...args), { wrapper: JotaiProvider });

// テスト対象はapplyAdminBoundaryData等の呼び出し時にmapインスタンス自体をそのまま渡すだけのため、
// 実体を必要としないダミーオブジェクトへキャストする
const asMap = (mock: object): maplibregl.Map => mock as never;

describe('useAdminBoundaryDataに関するテスト（Issue #127）', () => {
  test('mapがnullの場合、applyAdminBoundaryData・getOrFetchMunicipalityBoundariesは呼ばれない', () => {
    const applyAdminBoundaryDataSpy = vi.spyOn(mapLayerSetup, 'applyAdminBoundaryData');
    const getOrFetchSpy = vi.spyOn(mapLayerSetup, 'getOrFetchMunicipalityBoundaries');
    const mapRef = { current: null };

    renderWithProvider(mapRef, 'current', null, true);

    expect(applyAdminBoundaryDataSpy).not.toHaveBeenCalled();
    expect(getOrFetchSpy).not.toHaveBeenCalled();
    applyAdminBoundaryDataSpy.mockRestore();
    getOrFetchSpy.mockRestore();
  });

  test('isStyleLoadedがfalseの場合、applyAdminBoundaryData・getOrFetchMunicipalityBoundariesは呼ばれない', () => {
    const applyAdminBoundaryDataSpy = vi.spyOn(mapLayerSetup, 'applyAdminBoundaryData');
    const getOrFetchSpy = vi.spyOn(mapLayerSetup, 'getOrFetchMunicipalityBoundaries');
    const mapRef = { current: asMap({}) };

    renderWithProvider(mapRef, 'current', null, false);

    expect(applyAdminBoundaryDataSpy).not.toHaveBeenCalled();
    expect(getOrFetchSpy).not.toHaveBeenCalled();
    applyAdminBoundaryDataSpy.mockRestore();
    getOrFetchSpy.mockRestore();
  });

  test('条件が揃っている場合、adminBoundaryEraを渡してapplyAdminBoundaryDataが呼ばれる', async () => {
    const applyAdminBoundaryDataSpy = vi.spyOn(mapLayerSetup, 'applyAdminBoundaryData').mockResolvedValue();
    vi.spyOn(mapLayerSetup, 'getOrFetchMunicipalityBoundaries').mockResolvedValue(EMPTY_FEATURE_COLLECTION);
    const map = asMap({});
    const mapRef = { current: map };

    renderWithProvider(mapRef, '2000-10-01', null, true);

    await waitFor(() => expect(applyAdminBoundaryDataSpy).toHaveBeenCalledTimes(1));
    expect(applyAdminBoundaryDataSpy).toHaveBeenCalledWith(map, '2000-10-01', expect.any(Map));
    vi.restoreAllMocks();
  });

  test('applyAdminBoundaryDataの完了後、onAdminBoundaryDataAppliedが呼ばれる（Issue #65）', async () => {
    vi.spyOn(mapLayerSetup, 'applyAdminBoundaryData').mockResolvedValue();
    vi.spyOn(mapLayerSetup, 'getOrFetchMunicipalityBoundaries').mockResolvedValue(EMPTY_FEATURE_COLLECTION);
    const mapRef = { current: asMap({}) };
    const onAdminBoundaryDataApplied = vi.fn();

    renderWithProvider(mapRef, 'current', null, true, onAdminBoundaryDataApplied);

    await waitFor(() => expect(onAdminBoundaryDataApplied).toHaveBeenCalledTimes(1));
    vi.restoreAllMocks();
  });

  test('applyAdminBoundaryDataの取得に失敗した場合でも、onAdminBoundaryDataAppliedは呼ばれグローバルエラースタックに追加される', async () => {
    vi.spyOn(mapLayerSetup, 'applyAdminBoundaryData').mockRejectedValue(new Error('fetch failed'));
    vi.spyOn(mapLayerSetup, 'getOrFetchMunicipalityBoundaries').mockResolvedValue(EMPTY_FEATURE_COLLECTION);
    const mapRef = { current: asMap({}) };
    const onAdminBoundaryDataApplied = vi.fn();

    const { result } = renderWithProvider(mapRef, 'current', null, true, onAdminBoundaryDataApplied);

    await waitFor(() => expect(onAdminBoundaryDataApplied).toHaveBeenCalledTimes(1));
    expect(result.current.errors.some((error) => error.message === 'fetch failed')).toBe(true);
    vi.restoreAllMocks();
  });

  test('focusedMunicipalityを指定した場合、境界データ取得後にapplyFocusedMunicipalityLayerが呼ばれる', async () => {
    vi.spyOn(mapLayerSetup, 'applyAdminBoundaryData').mockResolvedValue();
    vi.spyOn(mapLayerSetup, 'getOrFetchMunicipalityBoundaries').mockResolvedValue(EMPTY_FEATURE_COLLECTION);
    const applyFocusedMunicipalityLayerSpy = vi
      .spyOn(mapLayerInteraction, 'applyFocusedMunicipalityLayer')
      .mockReturnValue(undefined);
    const map = asMap({});
    const mapRef = { current: map };
    const focusedMunicipality = { prefectureName: '東京都', municipalityName: '渋谷区' };

    renderWithProvider(mapRef, 'current', focusedMunicipality, true);

    await waitFor(() =>
      expect(applyFocusedMunicipalityLayerSpy).toHaveBeenCalledWith(map, EMPTY_FEATURE_COLLECTION, focusedMunicipality)
    );
    vi.restoreAllMocks();
  });

  test('境界データの取得に成功しfeatureが見つかった場合、panToMunicipalityCentroidが呼ばれる', async () => {
    vi.spyOn(mapLayerSetup, 'applyAdminBoundaryData').mockResolvedValue();
    vi.spyOn(mapLayerSetup, 'getOrFetchMunicipalityBoundaries').mockResolvedValue(EMPTY_FEATURE_COLLECTION);
    const feature = {
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [139.7, 35.6] },
      properties: {}
    };
    vi.spyOn(mapLayerInteraction, 'applyFocusedMunicipalityLayer').mockReturnValue(feature);
    const panToMunicipalityCentroidSpy = vi
      .spyOn(mapLayerInteraction, 'panToMunicipalityCentroid')
      .mockImplementation(() => {});
    const map = asMap({});
    const mapRef = { current: map };

    renderWithProvider(mapRef, 'current', { prefectureName: '東京都', municipalityName: '渋谷区' }, true);

    await waitFor(() => expect(panToMunicipalityCentroidSpy).toHaveBeenCalledWith(map, feature));
    vi.restoreAllMocks();
  });

  test('通過自治体の取得に失敗した場合、グローバルエラースタックに追加される', async () => {
    vi.spyOn(mapLayerSetup, 'applyAdminBoundaryData').mockResolvedValue();
    vi.spyOn(mapLayerSetup, 'getOrFetchMunicipalityBoundaries').mockRejectedValue(new Error('boundary fetch failed'));
    const mapRef = { current: asMap({}) };

    const { result } = renderWithProvider(mapRef, 'current', null, true);

    await waitFor(() =>
      expect(result.current.errors.some((error) => error.message === 'boundary fetch failed')).toBe(true)
    );
    vi.restoreAllMocks();
  });
});
