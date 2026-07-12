// biome-ignore-all lint/style/useNamingConvention: 国土数値情報(N03)のプロパティ名にそのまま合わせるため
import 'dotenv/config';
import type { MultiPolygon, Polygon } from 'geojson';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { DataSource } from 'typeorm';
import { createDataSourceOptions } from '../database/database.config';
import { MunicipalityEntity } from './entities/municipality.entity';

const PREFECTURE_CODE_MIN = 1;
const PREFECTURE_CODE_MAX = 47;
const PREFECTURE_CODE_LENGTH = 2;
// 国土数値情報(N03)の最新基準日。全都道府県で2023-01-01が最新であることを確認済み
const TOPOJSON_DATE = '20230101';
// 政令指定都市統合版ではない方(xx_city)・高解像度版(h)を使う（Issue #18の指定通り）
const TOPOJSON_RESOLUTION = 'h';
const INSERT_BATCH_SIZE = 500;

/** N03形式の市区町村ポリゴンのプロパティ（都道府県名・郡/政令市名・市区町村名） */
type CityProperties = {
  /** 都道府県名 */
  N03_001: string;
  /** 郡・政令指定都市名（政令指定都市の区の場合のみ設定され、それ以外はnull） */
  N03_003: string | null;
  /** 市区町村名（政令指定都市の区の場合は区名のみ） */
  N03_004: string;
};

/**
 * 政令指定都市の区の場合は市名を含めた表示用の市区町村名を組み立てる（例: 横浜市+中区 → 横浜市中区）
 * @param properties N03形式のプロパティ
 * @returns 表示用の市区町村名
 */
const buildMunicipalityName = (properties: CityProperties): string =>
  properties.N03_003 === null ? properties.N03_004 : `${properties.N03_003}${properties.N03_004}`;

/**
 * Polygon・MultiPolygonいずれのジオメトリもMultiPolygonへ正規化する
 * @param geometry topojson-clientが返したジオメトリ
 * @returns MultiPolygon形式のジオメトリ
 */
const toMultiPolygon = (geometry: Polygon | MultiPolygon): MultiPolygon =>
  geometry.type === 'Polygon' ? { type: 'MultiPolygon', coordinates: [geometry.coordinates] } : geometry;

/**
 * 指定した都道府県コードのtopojsonデータを取得し、市区町村ごとのMunicipalityEntityへ変換する
 * @param prefectureCode 2桁ゼロ埋めの都道府県コード（例: '13'）
 * @returns 変換済みのMunicipalityEntity一覧
 */
const fetchMunicipalitiesForPrefecture = async (prefectureCode: string): Promise<MunicipalityEntity[]> => {
  const url = `https://geoshape.ex.nii.ac.jp/city/topojson/${TOPOJSON_DATE}/${prefectureCode}/${prefectureCode}_city.${TOPOJSON_RESOLUTION}.topojson`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`都道府県コード${prefectureCode}のtopojson取得に失敗しました（HTTP ${response.status}）: ${url}`);
  }

  const topology = (await response.json()) as Topology;
  const objectName = Object.keys(topology.objects)[0];
  const geometryCollection = topology.objects[objectName] as GeometryCollection<CityProperties>;
  const featureCollection = feature(topology, geometryCollection);

  return featureCollection.features.map((cityFeature) => {
    const properties = cityFeature.properties as CityProperties;
    const geometry = cityFeature.geometry as Polygon | MultiPolygon;

    const entity = new MunicipalityEntity();
    entity.prefectureName = properties.N03_001;
    entity.municipalityName = buildMunicipalityName(properties);
    entity.geom = toMultiPolygon(geometry);
    return entity;
  });
};

/** municipalitiesテーブルへ全都道府県分の市区町村境界データを投入する */
const seedMunicipalities = async (): Promise<void> => {
  const dataSource = new DataSource(createDataSourceOptions(process.env));
  await dataSource.initialize();
  const repository = dataSource.getRepository(MunicipalityEntity);

  // 再実行時に重複投入しないよう、毎回全件洗い替えする
  await repository.clear();

  for (let code = PREFECTURE_CODE_MIN; code <= PREFECTURE_CODE_MAX; code += 1) {
    const prefectureCode = String(code).padStart(PREFECTURE_CODE_LENGTH, '0');
    const municipalities = await fetchMunicipalitiesForPrefecture(prefectureCode);

    for (let offset = 0; offset < municipalities.length; offset += INSERT_BATCH_SIZE) {
      await repository.save(municipalities.slice(offset, offset + INSERT_BATCH_SIZE));
    }
    console.log(`${prefectureCode}: ${municipalities.length}件投入しました`);
  }

  await dataSource.destroy();
  console.log('municipalitiesへの投入が完了しました');
};

seedMunicipalities().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
