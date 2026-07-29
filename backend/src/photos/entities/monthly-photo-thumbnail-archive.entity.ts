import { Column, Entity } from 'typeorm';

const MONTHLY_PHOTO_THUMBNAIL_ARCHIVES_TABLE_NAME = 'monthly_photo_thumbnail_archives';

/**
 * グリッド・吹き出し表示用のサムネイル専用zip（`<年月>-thumbnails`）の所在を年月ごとに記録する
 * （Issue #100）。`monthly_photo_archives`（フルサイズ写真用）とは別ファイル・別テーブルで管理する。
 * 生成対象は動画削除・part統合済み（`video_stripped_year_months`に記録済み）の年月のみであり、
 * 常に1年月=1zipのためpart列は持たない
 */
@Entity({ name: MONTHLY_PHOTO_THUMBNAIL_ARCHIVES_TABLE_NAME })
export class MonthlyPhotoThumbnailArchiveEntity {
  // 'YYYY-MM'形式（例: '2026-07'）。サムネイルzipを生成済みの年月ごとに1件存在する
  @Column({ name: 'year_month', primary: true })
  yearMonth!: string;

  // サムネイルzip（<年月>-thumbnails.zip）のGoogle DriveファイルID
  @Column({ name: 'drive_file_id' })
  driveFileId!: string;
}
