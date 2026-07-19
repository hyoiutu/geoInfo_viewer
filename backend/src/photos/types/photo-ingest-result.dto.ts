import { ApiProperty } from '@nestjs/swagger';

/** POST /photos/ingest のレスポンス */
export class PhotoIngestResultDto {
  @ApiProperty({ description: '撮影日時が取得でき、DBへ保存した写真の件数' })
  savedCount!: number;

  @ApiProperty({ description: '撮影日時が取得できずスキップした写真の件数' })
  skippedCount!: number;
}
