import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

const MONTHLY_PHOTO_ARCHIVES_TABLE_NAME = 'monthly_photo_archives';

/**
 * 撮影年月ごとに再構成されたTakeout写真zipが、Google Drive上のどのファイルに
 * 対応するかを追跡する。取り込みパイプラインはこのテーブルを参照し、対象年月・partの
 * zipが既存であればダウンロードして写真を追記し、無ければ新規作成する（Issue #23）
 */
@Entity({ name: MONTHLY_PHOTO_ARCHIVES_TABLE_NAME })
@Unique(['yearMonth', 'part'])
export class MonthlyPhotoArchiveEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  // 'YYYY-MM'形式（例: '2026-07'）。1つの年月に対し、part違いで複数件存在しうる
  @Column({ name: 'year_month' })
  yearMonth!: string;

  // 1つの年月をサイズ超過により複数zipへ分割した場合の連番（0始まり）。
  // 巨大な月をメモリに一度に載せようとするとプロセスがメモリ不足で強制終了される問題への対策として導入した
  // （`backfill-photos-from-local.ts`のMAX_ARCHIVE_PART_SIZE_BYTES参照、Issue #23）。
  // -1（LEGACY_WHOLE_MONTH_PART）は、この列が存在しなかった時代に「その年月の全写真を含む唯一のzip」として
  // 作成された既存行を表す特別な値であり、サイズに関わらず常に処理済みとして扱われる
  @Column({ name: 'part' })
  part!: number;

  // 再構成先のzipのGoogle DriveファイルID
  @Column({ name: 'drive_file_id' })
  driveFileId!: string;
}
