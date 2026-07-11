import type { MigrationInterface, QueryRunner } from 'typeorm';

/** postgis拡張の有効化と、cycling_activities・sync_stateテーブルの新規作成を行うマイグレーション */
export class CreateCyclingActivitiesAndSyncState1720400000000 implements MigrationInterface {
  /**
   * postgis拡張を有効化し、cycling_activities・sync_stateテーブルを作成する
   * @param queryRunner マイグレーション実行用のクエリランナー
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS postgis');

    await queryRunner.query(`
      CREATE TABLE "cycling_activities" (
        "id" bigint PRIMARY KEY,
        "name" varchar NOT NULL,
        "distance_meters" double precision NOT NULL,
        "moving_time_seconds" integer NOT NULL,
        "start_date" timestamptz NOT NULL,
        "path" geometry(LineString, 4326)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "sync_state" (
        "id" varchar PRIMARY KEY,
        "last_synced_at" timestamptz
      )
    `);
  }

  /**
   * cycling_activities・sync_stateテーブルを削除する（upの取り消し）
   * @param queryRunner マイグレーション実行用のクエリランナー
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "sync_state"');
    await queryRunner.query('DROP TABLE "cycling_activities"');
  }
}
