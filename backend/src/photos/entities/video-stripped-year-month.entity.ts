import { Column, Entity } from 'typeorm';

const VIDEO_STRIPPED_YEAR_MONTHS_TABLE_NAME = 'video_stripped_year_months';

/**
 * 動画除去・part統合が完了済みの年月を記録する。既存の月別アーカイブzipから動画を削除し、
 * part分割された年月を単一のzipへ統合する一括処理（Issue #97）の進捗管理専用であり、
 * 中断・再実行時に処理済みの年月を丸ごとスキップするために参照する
 */
@Entity({ name: VIDEO_STRIPPED_YEAR_MONTHS_TABLE_NAME })
export class VideoStrippedYearMonthEntity {
  // 'YYYY-MM'形式（例: '2026-07'）。処理済みの年月ごとに1件存在する
  @Column({ name: 'year_month', primary: true })
  yearMonth!: string;
}
