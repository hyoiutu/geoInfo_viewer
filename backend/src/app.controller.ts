import { Controller, Get } from '@nestjs/common';
import { AppService, type HealthStatus } from './app.service';

const HEALTH_ROUTE = 'health';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get(HEALTH_ROUTE)
  getHealth(): HealthStatus {
    return this.appService.getHealth();
  }
}
