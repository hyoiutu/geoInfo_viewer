import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * cycling_activitiesテーブルにsummary_path列（低ズームレベル表示用の簡略化された軌跡、Issue #61）を追加する
 * マイグレーション。適用前に取り込み済みの既存行はNULLのままになる。正確な値を反映するには、
 * 「フォースリフェッチ」ボタン（ActivitiesBackfillService.startForceRefetch）で再取得する
 */
export class AddSummaryPathToCyclingActivities1785347504217 implements MigrationInterface {
  /**
   * cycling_activitiesテーブルにsummary_path列を追加する
   * @param queryRunner マイグレーション実行用のクエリランナー
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cycling_activities"
      ADD COLUMN "summary_path" geometry(MultiLineString,4326) NULL
    `);
  }

  /**
   * summary_path列を削除する（upの取り消し）
   * @param queryRunner マイグレーション実行用のクエリランナー
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cycling_activities"
      DROP COLUMN "summary_path"
    `);
  }
}
