import type { MigrationInterface, QueryRunner } from 'typeorm';

/** municipalities（市区町村境界）テーブルを新規作成するマイグレーション */
export class CreateMunicipalities1720700000000 implements MigrationInterface {
  /**
   * municipalitiesテーブルと、空間検索用のGiSTインデックスを作成する
   * @param queryRunner マイグレーション実行用のクエリランナー
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "municipalities" (
        "id" SERIAL PRIMARY KEY,
        "prefecture_name" varchar NOT NULL,
        "municipality_name" varchar NOT NULL,
        "geom" geometry(MultiPolygon, 4326) NOT NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "municipalities_geom_idx" ON "municipalities" USING GIST ("geom")
    `);
  }

  /**
   * municipalitiesテーブルを削除する（upの取り消し）
   * @param queryRunner マイグレーション実行用のクエリランナー
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "municipalities"');
  }
}
