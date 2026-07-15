import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * cycling_activitiesテーブルのpath列を、LineStringからMultiLineStringへ変更するマイグレーション。
 * トンネル内・フェリー乗船中等の測定不能区間による位置飛び（隣接点間10km以上）を、
 * 単一の線ではなく複数の区間に分けて保持できるようにするため（Issue #27）。
 * 既存行はST_Multi()で単一区間のMultiLineStringへそのまま変換する（位置飛びの再判定は行わない）。
 * 既存アクティビティに実際に位置飛びの分割を適用するには、「フォースリフェッチ」ボタンで再取得する
 */
export class ChangeCyclingActivitiesPathToMultiLineString1720800000000 implements MigrationInterface {
  /**
   * path列の型をgeometry(LineString,4326)からgeometry(MultiLineString,4326)へ変更する
   * @param queryRunner マイグレーション実行用のクエリランナー
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cycling_activities"
      ALTER COLUMN "path" TYPE geometry(MultiLineString,4326) USING ST_Multi("path")
    `);
  }

  /**
   * path列の型をgeometry(MultiLineString,4326)からgeometry(LineString,4326)へ戻す（upの取り消し）。
   * 複数区間を持つ行が存在する場合、最初の区間のみを残す（データが失われる可能性がある）
   * @param queryRunner マイグレーション実行用のクエリランナー
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cycling_activities"
      ALTER COLUMN "path" TYPE geometry(LineString,4326) USING ST_GeometryN("path", 1)
    `);
  }
}
