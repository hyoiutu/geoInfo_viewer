import { Injectable } from '@nestjs/common';

const HEALTH_STATUS_OK = 'ok';

/** ヘルスチェックAPIのレスポンス */
export type HealthStatus = {
  /** サーバーが正常に起動していることを表す固定値 */
  status: typeof HEALTH_STATUS_OK;
};

/** アプリ全体のヘルスチェックを担うサービス */
@Injectable()
export class AppService {
  /** @returns 常に正常であることを表すステータス */
  getHealth(): HealthStatus {
    return { status: HEALTH_STATUS_OK };
  }
}
