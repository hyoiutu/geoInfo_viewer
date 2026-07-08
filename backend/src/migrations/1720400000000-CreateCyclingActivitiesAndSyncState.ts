import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCyclingActivitiesAndSyncState1720400000000 implements MigrationInterface {
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

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "sync_state"');
    await queryRunner.query('DROP TABLE "cycling_activities"');
  }
}
