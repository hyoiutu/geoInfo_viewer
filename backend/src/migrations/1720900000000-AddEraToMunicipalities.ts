import type { MigrationInterface, QueryRunner } from 'typeorm';

const CURRENT_ERA = 'current';

/**
 * municipalitiesテーブルにera列（年代識別子）を追加するマイグレーション（Issue #34）。
 * 過去の行政区画（2000-10-01・1950-10-01・1920-01-01等）を同じテーブルに複数年代分格納できるようにする。
 * 既存行（現行の行政区画データ）はera='current'として扱う
 */
export class AddEraToMunicipalities1720900000000 implements MigrationInterface {
  /**
   * era列を追加し、既存行にera='current'を設定した上でNOT NULL制約を付与する。
   * 年代ごとの絞り込みクエリで使うためのインデックスも作成する
   * @param queryRunner マイグレーション実行用のクエリランナー
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "municipalities" ADD COLUMN "era" varchar
    `);
    await queryRunner.query(`UPDATE "municipalities" SET "era" = $1 WHERE "era" IS NULL`, [CURRENT_ERA]);
    await queryRunner.query(`
      ALTER TABLE "municipalities" ALTER COLUMN "era" SET NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "municipalities_era_idx" ON "municipalities" ("era")
    `);
  }

  /**
   * era列とそのインデックスを削除する（upの取り消し）。era='current'以外の行が存在する場合、
   * それらの過去年代データも削除対象となる（データが失われる可能性がある）
   * @param queryRunner マイグレーション実行用のクエリランナー
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "municipalities" WHERE "era" != $1`, [CURRENT_ERA]);
    await queryRunner.query(`DROP INDEX "municipalities_era_idx"`);
    await queryRunner.query(`ALTER TABLE "municipalities" DROP COLUMN "era"`);
  }
}
