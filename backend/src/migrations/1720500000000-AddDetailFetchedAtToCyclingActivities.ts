import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDetailFetchedAtToCyclingActivities1720500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cycling_activities"
      ADD COLUMN "detail_fetched_at" timestamptz
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cycling_activities"
      DROP COLUMN "detail_fetched_at"
    `);
  }
}
