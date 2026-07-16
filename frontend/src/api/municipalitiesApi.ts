import type { FeatureCollection } from 'geojson';
import type { MunicipalityEra } from '../types/municipalityEra';
import { buildApiError } from '../utils/apiError';

const DEFAULT_BACKEND_BASE_URL = 'http://localhost:3000';
// E2Eテストは開発用バックエンド(3000番ポート)との衝突を避けるため別ポートで起動する。
// ビルド時にVITE_BACKEND_BASE_URLを設定することで接続先を切り替える（playwright.config.ts参照）
const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_BASE_URL ?? DEFAULT_BACKEND_BASE_URL;
const MUNICIPALITIES_BOUNDARIES_PATH = '/municipalities/boundaries';

/**
 * 指定した年代の市区町村境界をGeoJSONで取得する
 * @param era 取得対象の年代識別子
 * @returns 境界ポリゴンのFeatureCollection
 */
export const fetchMunicipalityBoundaries = async (era: MunicipalityEra): Promise<FeatureCollection> => {
  const response = await fetch(`${BACKEND_BASE_URL}${MUNICIPALITIES_BOUNDARIES_PATH}?era=${era}`);

  if (!response.ok) {
    throw await buildApiError(response);
  }

  return response.json();
};
