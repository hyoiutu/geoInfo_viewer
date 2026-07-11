import { ApiProperty } from '@nestjs/swagger';

/** フロントエンドへ返す自転車ログ（アクティビティ）1件分 */
export class CyclingActivityDto {
  /** StravaのアクティビティID */
  @ApiProperty({ description: 'StravaのアクティビティID' })
  id!: string;

  /** アクティビティ名 */
  @ApiProperty({ description: 'アクティビティ名' })
  name!: string;

  /** 走行距離（メートル） */
  @ApiProperty({ description: '走行距離（メートル）' })
  distanceMeters!: number;

  /** 走行時間（秒） */
  @ApiProperty({ description: '走行時間（秒）' })
  movingTimeSeconds!: number;

  /** 開始日時（ISO 8601形式の文字列） */
  @ApiProperty({ description: '開始日時（ISO 8601形式の文字列）' })
  startDate!: string;

  /** 軌跡（経度・緯度の配列）。GPSルートの無いアクティビティの場合はnull */
  @ApiProperty({
    description: '軌跡（経度・緯度の配列）。GPSルートの無いアクティビティの場合はnull',
    type: 'array',
    items: { type: 'array', items: { type: 'number' } },
    nullable: true
  })
  path!: [number, number][] | null;
}
