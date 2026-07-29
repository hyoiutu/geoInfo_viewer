import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * monthly_photo_thumbnail_archives（グリッド・吹き出し表示用のサムネイル専用zipの所在を
 * 年月ごとに記録する）テーブルを新規作成するマイグレーション。フルサイズ写真用の
 * `monthly_photo_archives`とは別テーブルで管理し、既存テーブルのスキーマは変更しない（Issue #100）
 */
export class CreateMonthlyPhotoThumbnailArchives1784947777761 implements MigrationInterface {
  /**
   * monthly_photo_thumbnail_archivesテーブルを作成する
   * @param queryRunner マイグレーション実行用のクエリランナー
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "monthly_photo_thumbnail_archives" (
        "year_month" varchar PRIMARY KEY,
        "drive_file_id" varchar NOT NULL
      )
    `);
  }

  /**
   * monthly_photo_thumbnail_archivesテーブルを削除する（upの取り消し）
   * @param queryRunner マイグレーション実行用のクエリランナー
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "monthly_photo_thumbnail_archives"');
  }
}
