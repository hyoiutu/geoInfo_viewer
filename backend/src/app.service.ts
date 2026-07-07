import { Injectable } from '@nestjs/common';

const HEALTH_STATUS_OK = 'ok';

export type HealthStatus = {
  status: typeof HEALTH_STATUS_OK;
};

@Injectable()
export class AppService {
  getHealth(): HealthStatus {
    return { status: HEALTH_STATUS_OK };
  }
}
