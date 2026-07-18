import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

const MONTHLY_PHOTO_ARCHIVES_TABLE_NAME = 'monthly_photo_archives';

/**
 * 撮影年月ごとに再構成されたTakeout写真zipが、Google Drive上のどのファイルに
 * 対応するかを追跡する。取り込みパイプラインはこのテーブルを参照し、対象年月の
 * zipが既存であればダウンロードして写真を追記し、無ければ新規作成する（Issue #23）
 */
@Entity({ name: MONTHLY_PHOTO_ARCHIVES_TABLE_NAME })
export class MonthlyPhotoArchiveEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  // 'YYYY-MM'形式（例: '2026-07'）。年月ごとに1件のみ存在する
  @Column({ name: 'year_month', unique: true })
  yearMonth!: string;

  // 再構成先のzipのGoogle DriveファイルID
  @Column({ name: 'drive_file_id' })
  driveFileId!: string;
}
