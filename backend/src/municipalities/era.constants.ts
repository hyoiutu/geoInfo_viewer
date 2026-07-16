import { BadRequestException } from '@nestjs/common';

/** 現行（最新）の行政区画を表す年代識別子 */
export const MUNICIPALITY_ERA_CURRENT = 'current';

/** 平成の大合併前（2000-10-01時点）の行政区画を表す年代識別子 */
export const MUNICIPALITY_ERA_PRE_HEISEI_MERGER = '2000-10-01';

/**
 * 選択可能な行政区画の年代識別子一覧（Issue #34）。現行データは'current'、過去データは
 * geoshape.ex.nii.ac.jp（国土数値情報 行政区域データ）の基準日をそのまま使う。
 * 過去年代を追加する場合はこの配列に追記し、`scripts/seed-municipalities.ts`で該当年代を投入すること。
 * 平成の大合併前（2000-10-01）のみ投入済み。昭和の大合併前（1950-10-01）・大正期（1920-01-01）は今後追加予定
 */
export const MUNICIPALITY_ERAS = [MUNICIPALITY_ERA_CURRENT, MUNICIPALITY_ERA_PRE_HEISEI_MERGER] as const;

/** 行政区画の年代識別子 */
export type MunicipalityEra = (typeof MUNICIPALITY_ERAS)[number];

/**
 * 与えられた値が選択可能な年代識別子かどうかを判定する
 * @param value 判定対象の値
 * @returns MUNICIPALITY_ERASに含まれる場合true
 */
export const isMunicipalityEra = (value: string): value is MunicipalityEra => {
  // 型ガードとして絞り込む前のstringを渡すため、includes()の引数型をMunicipalityEraに限定させないよう広げる
  const eras: readonly string[] = MUNICIPALITY_ERAS;
  return eras.includes(value);
};

/**
 * クエリパラメータ等から受け取った年代の値を検証する。APIの入力境界（コントローラー）から呼び出す想定
 * @param value 検証対象の値
 * @returns 検証済みの年代識別子
 * @throws {BadRequestException} MUNICIPALITY_ERASに含まれない値の場合
 */
export const assertMunicipalityEra = (value: string): MunicipalityEra => {
  if (!isMunicipalityEra(value)) {
    throw new BadRequestException(`不正な年代が指定されました: ${value}`);
  }
  return value;
};
