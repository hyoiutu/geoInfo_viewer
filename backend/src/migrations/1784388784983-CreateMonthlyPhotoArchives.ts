import type { MigrationInterface, QueryRunner } from 'typeorm';

/** monthly_photo_archives（撮影年月ごとに再構成したTakeout写真zipの管理）テーブルを新規作成するマイグレーション */
export class CreateMonthlyPhotoArchives1784388784983 implements MigrationInterface {
  /**
   * monthly_photo_archivesテーブルと、年月の一意制約を作成する
   * @param queryRunner マイグレーション実行用のクエリランナー
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "monthly_photo_archives" (
        "id" SERIAL PRIMARY KEY,
        "year_month" varchar NOT NULL,
        "drive_file_id" varchar NOT NULL,
        CONSTRAINT "monthly_photo_archives_year_month_unique" UNIQUE ("year_month")
      )
    `);
  }

  /**
   * monthly_photo_archivesテーブルを削除する（upの取り消し）
   * @param queryRunner マイグレーション実行用のクエリランナー
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "monthly_photo_archives"');
  }
}
