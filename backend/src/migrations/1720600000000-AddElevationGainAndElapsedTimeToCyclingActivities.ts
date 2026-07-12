import type { MigrationInterface, QueryRunner } from 'typeorm';

const DEFAULT_ELAPSED_TIME_SECONDS = 0;
const DEFAULT_ELEVATION_GAIN_METERS = 0;

/**
 * cycling_activitiesテーブルにelapsed_time_seconds・elevation_gain_meters列を追加するマイグレーション。
 * 適用前に取り込み済みの既存行はデフォルト値(0)で埋まる。正確な値を反映するには、
 * 「自転車ログ強制再取得」ボタン（ActivitiesBackfillService.startForceRefetch）で再取得する
 */
export class AddElevationGainAndElapsedTimeToCyclingActivities1720600000000 implements MigrationInterface {
  /**
   * cycling_activitiesテーブルにelapsed_time_seconds・elevation_gain_meters列を追加する
   * @param queryRunner マイグレーション実行用のクエリランナー
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cycling_activities"
      ADD COLUMN "elapsed_time_seconds" integer NOT NULL DEFAULT ${DEFAULT_ELAPSED_TIME_SECONDS}
    `);
    await queryRunner.query(`
      ALTER TABLE "cycling_activities"
      ADD COLUMN "elevation_gain_meters" double precision NOT NULL DEFAULT ${DEFAULT_ELEVATION_GAIN_METERS}
    `);
  }

  /**
   * elapsed_time_seconds・elevation_gain_meters列を削除する（upの取り消し）
   * @param queryRunner マイグレーション実行用のクエリランナー
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cycling_activities"
      DROP COLUMN "elevation_gain_meters"
    `);
    await queryRunner.query(`
      ALTER TABLE "cycling_activities"
      DROP COLUMN "elapsed_time_seconds"
    `);
  }
}
