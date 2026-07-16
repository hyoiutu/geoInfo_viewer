// biome-ignore-all lint/style/useNamingConvention: 国土数値情報(N03)のプロパティ名にそのまま合わせるため
import 'dotenv/config';
import type { GeometryObject, MultiPolygon, Polygon } from 'geojson';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { DataSource, type Repository } from 'typeorm';
import { createDataSourceOptions } from '../database/database.config';
import { MunicipalityEntity } from './entities/municipality.entity';
import { MUNICIPALITY_ERAS, type MunicipalityEra } from './era.constants';

const PREFECTURE_CODE_MIN = 1;
const PREFECTURE_CODE_MAX = 47;
const PREFECTURE_CODE_LENGTH = 2;
// 政令指定都市統合版ではない方(xx_city)・高解像度版(h)を使う（Issue #18の指定通り）
const TOPOJSON_RESOLUTION = 'h';
// 1都道府県分を1回のsave()にまとめて投入すると、TypeORMが発行するINSERT文のバインドパラメータ数が
// PostgreSQLの上限(65535個)に抵触しうる（市区町村数が多い都道府県で発生しうる）ため、この件数ごとに分割して投入する
const INSERT_BATCH_SIZE = 500;

// 年代識別子(era)と、geoshape.ex.nii.ac.jpのtopojson取得に使う基準日(YYYYMMDD)の対応。
// 'current'は国土数値情報(N03)の最新基準日（全都道府県で2023-01-01が最新であることを確認済み）、
// 過去年代はIssue #34が指定する基準日（2000-10-01=平成の大合併前 等）をそのまま使う
const TOPOJSON_DATE_BY_ERA: Record<MunicipalityEra, string> = {
  current: '20230101',
  '2000-10-01': '20001001'
};

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
 * topojson-clientが返すジオメトリが、市区町村境界データとして期待するPolygon・MultiPolygonかどうかを判定する
 * @param geometry 判定対象のジオメトリ
 * @returns Polygon・MultiPolygonであればtrue（型ガードとしてもtrue時にPolygon | MultiPolygonへ絞り込む）
 */
const isPolygonOrMultiPolygon = (geometry: GeometryObject): geometry is Polygon | MultiPolygon =>
  geometry.type === 'Polygon' || geometry.type === 'MultiPolygon';

/**
 * 指定した都道府県コード・年代のtopojsonデータを取得し、市区町村ごとのMunicipalityEntityへ変換する
 * @param prefectureCode 2桁ゼロ埋めの都道府県コード（例: '13'）
 * @param era 取得対象の年代識別子
 * @returns 変換済みのMunicipalityEntity一覧
 */
const fetchMunicipalitiesForPrefecture = async (
  prefectureCode: string,
  era: MunicipalityEra
): Promise<MunicipalityEntity[]> => {
  const topojsonDate = TOPOJSON_DATE_BY_ERA[era];
  const url = `https://geoshape.ex.nii.ac.jp/city/topojson/${topojsonDate}/${prefectureCode}/${prefectureCode}_city.${TOPOJSON_RESOLUTION}.topojson`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `都道府県コード${prefectureCode}(era: ${era})のtopojson取得に失敗しました（HTTP ${response.status}）: ${url}`
    );
  }

  // 外部から取得したtopojsonデータの構造はランタイムでは検証できない境界のため、
  // 型注釈（asによるキャストではなく変数宣言時の型注釈）でN03形式であることを信頼する
  const topology: Topology<{ [key: string]: GeometryCollection<CityProperties> }> = await response.json();
  const objectName = Object.keys(topology.objects)[0];
  const geometryCollection = topology.objects[objectName];
  const featureCollection = feature(topology, geometryCollection);

  return featureCollection.features.flatMap((cityFeature) => {
    if (!isPolygonOrMultiPolygon(cityFeature.geometry)) {
      return [];
    }
    const properties = cityFeature.properties;

    const entity = new MunicipalityEntity();
    entity.era = era;
    entity.prefectureName = properties.N03_001;
    entity.municipalityName = buildMunicipalityName(properties);
    entity.geom = toMultiPolygon(cityFeature.geometry);
    return [entity];
  });
};

/**
 * 指定した年代の市区町村境界データを、全都道府県分municipalitiesテーブルへ投入する。
 * 同一年代の既存行のみを洗い替える（他年代の行には影響しない）
 * @param repository municipalitiesテーブルのRepository
 * @param era 投入対象の年代識別子
 */
const seedMunicipalitiesForEra = async (
  repository: Repository<MunicipalityEntity>,
  era: MunicipalityEra
): Promise<void> => {
  await repository.delete({ era });

  for (let code = PREFECTURE_CODE_MIN; code <= PREFECTURE_CODE_MAX; code += 1) {
    const prefectureCode = String(code).padStart(PREFECTURE_CODE_LENGTH, '0');
    const municipalities = await fetchMunicipalitiesForPrefecture(prefectureCode, era);

    for (let offset = 0; offset < municipalities.length; offset += INSERT_BATCH_SIZE) {
      await repository.save(municipalities.slice(offset, offset + INSERT_BATCH_SIZE));
    }
    console.log(`[${era}] ${prefectureCode}: ${municipalities.length}件投入しました`);
  }
};

/** municipalitiesテーブルへ、MUNICIPALITY_ERASで定義された全年代分の市区町村境界データを投入する */
const seedMunicipalities = async (): Promise<void> => {
  const dataSource = new DataSource(createDataSourceOptions(process.env));
  await dataSource.initialize();
  const repository = dataSource.getRepository(MunicipalityEntity);

  for (const era of MUNICIPALITY_ERAS) {
    await seedMunicipalitiesForEra(repository, era);
  }

  await dataSource.destroy();
  console.log('municipalitiesへの投入が完了しました');
};

seedMunicipalities().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
