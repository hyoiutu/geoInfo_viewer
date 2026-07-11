import { Controller, Get } from '@nestjs/common';
import { AppService, type HealthStatus } from './app.service';

const HEALTH_ROUTE = 'health';

/** アプリ全体のヘルスチェック用エンドポイントを提供するコントローラー */
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /** GET /health: サーバーが起動していることを確認するためのヘルスチェック */
  @Get(HEALTH_ROUTE)
  getHealth(): HealthStatus {
    return this.appService.getHealth();
  }
}
