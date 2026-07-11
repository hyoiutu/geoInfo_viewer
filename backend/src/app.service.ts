import { Injectable } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';

const HEALTH_STATUS_OK = 'ok';

/** ヘルスチェックAPIのレスポンス */
export class HealthStatus {
  /** サーバーが正常に起動していることを表す固定値 */
  @ApiProperty({ description: 'サーバーが正常に起動していることを表す固定値', enum: [HEALTH_STATUS_OK] })
  status!: typeof HEALTH_STATUS_OK;
}

/** アプリ全体のヘルスチェックを担うサービス */
@Injectable()
export class AppService {
  /** @returns 常に正常であることを表すステータス */
  getHealth(): HealthStatus {
    return { status: HEALTH_STATUS_OK };
  }
}
