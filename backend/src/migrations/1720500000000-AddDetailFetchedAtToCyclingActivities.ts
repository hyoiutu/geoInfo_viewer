import type { MigrationInterface, QueryRunner } from 'typeorm';

/** cycling_activitiesテーブルにdetail_fetched_at列を追加するマイグレーション */
export class AddDetailFetchedAtToCyclingActivities1720500000000 implements MigrationInterface {
  /**
   * cycling_activitiesテーブルにdetail_fetched_at列を追加する
   * @param queryRunner マイグレーション実行用のクエリランナー
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cycling_activities"
      ADD COLUMN "detail_fetched_at" timestamptz
    `);
  }

  /**
   * detail_fetched_at列を削除する（upの取り消し）
   * @param queryRunner マイグレーション実行用のクエリランナー
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cycling_activities"
      DROP COLUMN "detail_fetched_at"
    `);
  }
}
