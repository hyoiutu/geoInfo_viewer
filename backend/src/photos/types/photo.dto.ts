import { ApiProperty } from '@nestjs/swagger';
import type { Point } from 'geojson';

/** フロントエンドへ返す写真1件分のメタデータ */
export class PhotoDto {
  /** 写真ID */
  @ApiProperty({ description: '写真ID' })
  id!: number;

  /** ファイル名 */
  @ApiProperty({ description: 'ファイル名' })
  fileName!: string;

  /** 撮影日時（ISO 8601形式の文字列） */
  @ApiProperty({ description: '撮影日時（ISO 8601形式の文字列）' })
  takenAt!: string;

  /** 撮影位置（GeoJSON Point）。位置情報が無い写真の場合はnull */
  @ApiProperty({ description: '撮影位置（GeoJSON Point）。位置情報が無い写真の場合はnull', nullable: true })
  location!: Point | null;
}
