// バックエンド(backend/src/municipalities/era.constants.ts)のMUNICIPALITY_ERASと値を一致させること（Issue #34）
/** 行政区画の年代識別子 */
export type MunicipalityEra = 'current' | '2000-10-01' | '1950-10-01' | '1920-01-01';

/** 現行（最新）の行政区画を表す年代識別子 */
export const MUNICIPALITY_ERA_CURRENT: MunicipalityEra = 'current';

/** 平成の大合併前（2000-10-01時点）の行政区画を表す年代識別子 */
export const MUNICIPALITY_ERA_PRE_HEISEI_MERGER: MunicipalityEra = '2000-10-01';

/** 昭和の大合併前（1950-10-01時点）の行政区画を表す年代識別子 */
export const MUNICIPALITY_ERA_PRE_SHOWA_MERGER: MunicipalityEra = '1950-10-01';

/** 大正時代（1920-01-01時点）の行政区画を表す年代識別子 */
export const MUNICIPALITY_ERA_TAISHO: MunicipalityEra = '1920-01-01';

const MUNICIPALITY_ERAS: MunicipalityEra[] = [
  MUNICIPALITY_ERA_CURRENT,
  MUNICIPALITY_ERA_PRE_HEISEI_MERGER,
  MUNICIPALITY_ERA_PRE_SHOWA_MERGER,
  MUNICIPALITY_ERA_TAISHO
];

/**
 * 与えられた値が行政区画の年代識別子かどうかを判定する（DOMイベント等、string型で受け取った値を
 * asによる型キャストではなく型ガードで絞り込むために使う）
 * @param value 判定対象の値
 * @returns MunicipalityEraのいずれかであればtrue
 */
export const isMunicipalityEra = (value: string): value is MunicipalityEra => {
  // 型ガードとして絞り込む前のstringを渡すため、includes()の引数型をMunicipalityEraに限定させないよう広げる
  const eras: string[] = MUNICIPALITY_ERAS;
  return eras.includes(value);
};
