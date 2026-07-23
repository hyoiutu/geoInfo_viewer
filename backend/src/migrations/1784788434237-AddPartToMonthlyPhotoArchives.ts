import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * monthly_photo_archivesに、1つの撮影年月を複数のzipファイルへ分割格納できるようにする`part`列を追加する。
 * 巨大な月（動画を多数含む等でGB規模になる場合）を1つのzipへまとめてメモリ上に保持しようとすると、
 * 実行環境の物理メモリを超えてプロセスが強制終了される不具合が写真ローカルバックフィルの実行時に
 * 実際に発生した（Issue #23）。対応として、1つの年月あたりの写真を一定サイズごとの「part」に分割し、
 * それぞれ独立したzipファイルとしてGoogle Driveへ保存できるようにする。
 * 既存の（本マイグレーション以前に作成された）行は、分割という概念が存在しなかった時代に
 * 「その年月の全写真を含む唯一のzip」として作成されたものである。これらを`part`のデフォルト値である
 * -1（LEGACY_WHOLE_MONTH_PART）でマークすることで、今後のサイズ超過による再分割の対象にはせず、
 * 「その年月は（サイズに関わらず）常に処理済み」として扱い続けられるようにする（`backfill-photos-from-local.ts`参照）
 */
export class AddPartToMonthlyPhotoArchives1784788434237 implements MigrationInterface {
  /**
   * `part`列を追加し（既存行は-1で初期化）、一意制約を`year_month`単独から`(year_month, part)`の組へ変更する
   * @param queryRunner マイグレーション実行用のクエリランナー
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "monthly_photo_archives"
      ADD COLUMN "part" integer NOT NULL DEFAULT -1
    `);
    await queryRunner.query(`
      ALTER TABLE "monthly_photo_archives"
      DROP CONSTRAINT "monthly_photo_archives_year_month_unique"
    `);
    await queryRunner.query(`
      ALTER TABLE "monthly_photo_archives"
      ADD CONSTRAINT "monthly_photo_archives_year_month_part_unique" UNIQUE ("year_month", "part")
    `);
  }

  /**
   * `part`列を削除し、一意制約を`year_month`単独へ戻す（upの取り消し）
   * @param queryRunner マイグレーション実行用のクエリランナー
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "monthly_photo_archives"
      DROP CONSTRAINT "monthly_photo_archives_year_month_part_unique"
    `);
    await queryRunner.query(`
      ALTER TABLE "monthly_photo_archives"
      ADD CONSTRAINT "monthly_photo_archives_year_month_unique" UNIQUE ("year_month")
    `);
    await queryRunner.query(`
      ALTER TABLE "monthly_photo_archives"
      DROP COLUMN "part"
    `);
  }
}
