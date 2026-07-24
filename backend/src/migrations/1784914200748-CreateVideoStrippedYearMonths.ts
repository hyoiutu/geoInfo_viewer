import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * video_stripped_year_months（動画除去・part統合が完了済みの年月を記録する）テーブルを新規作成する
 * マイグレーション。既存の月別アーカイブzip（写真ローカルバックフィルで作成済み）から動画を削除し、
 * part分割された年月を単一のzipへ統合する一括処理（Issue #97）の進捗管理専用テーブルであり、
 * `monthly_photo_archives`本体のスキーマは変更しない
 */
export class CreateVideoStrippedYearMonths1784914200748 implements MigrationInterface {
  /**
   * video_stripped_year_monthsテーブルを作成する
   * @param queryRunner マイグレーション実行用のクエリランナー
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "video_stripped_year_months" (
        "year_month" varchar PRIMARY KEY
      )
    `);
  }

  /**
   * video_stripped_year_monthsテーブルを削除する（upの取り消し）
   * @param queryRunner マイグレーション実行用のクエリランナー
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "video_stripped_year_months"');
  }
}
