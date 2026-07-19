import type { MigrationInterface, QueryRunner } from 'typeorm';

/** photos（Google Takeoutから取り込んだ写真のメタデータ）テーブルを新規作成するマイグレーション */
export class CreatePhotos1784369772129 implements MigrationInterface {
  /**
   * photosテーブルと、位置情報検索用のGiSTインデックスを作成する
   * @param queryRunner マイグレーション実行用のクエリランナー
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "photos" (
        "id" SERIAL PRIMARY KEY,
        "file_name" varchar NOT NULL,
        "taken_at" timestamptz NOT NULL,
        "location" geometry(Point, 4326),
        "source_file_id" varchar NOT NULL,
        "archive_path" varchar NOT NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "photos_location_idx" ON "photos" USING GIST ("location")
    `);
  }

  /**
   * photosテーブルを削除する（upの取り消し）
   * @param queryRunner マイグレーション実行用のクエリランナー
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "photos"');
  }
}
