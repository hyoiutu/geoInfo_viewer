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

  /** 走行時間（秒、停止時間を含まない） */
  @ApiProperty({ description: '走行時間（秒、停止時間を含まない）' })
  movingTimeSeconds!: number;

  /** 経過時間（秒、停止時間を含む。開始日時に加算すると終了日時になる） */
  @ApiProperty({ description: '経過時間（秒、停止時間を含む。開始日時に加算すると終了日時になる）' })
  elapsedTimeSeconds!: number;

  /** 獲得標高（メートル） */
  @ApiProperty({ description: '獲得標高（メートル）' })
  elevationGainMeters!: number;

  /** 開始日時（ISO 8601形式の文字列） */
  @ApiProperty({ description: '開始日時（ISO 8601形式の文字列）' })
  startDate!: string;

  /**
   * 軌跡（区間ごとの経度・緯度配列の配列）。位置飛び（隣接点間10km以上、トンネル内・フェリー乗船中等の
   * 測定不能区間）で区間分割されている。GPSルートの無いアクティビティの場合はnull
   */
  @ApiProperty({
    description:
      '軌跡（区間ごとの経度・緯度配列の配列）。位置飛び（隣接点間10km以上）で区間分割されている。GPSルートの無いアクティビティの場合はnull',
    type: 'array',
    items: { type: 'array', items: { type: 'array', items: { type: 'number' } } },
    nullable: true
  })
  path!: [number, number][][] | null;
}
