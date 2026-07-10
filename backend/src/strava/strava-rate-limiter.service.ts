import { Injectable } from '@nestjs/common';
import { STRAVA_NON_UPLOAD_RATE_LIMIT_PER_WINDOW, STRAVA_NON_UPLOAD_RATE_LIMIT_WINDOW_MS } from './strava.constants';

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class StravaRateLimiterService {
  private readonly intervalMs = STRAVA_NON_UPLOAD_RATE_LIMIT_WINDOW_MS / STRAVA_NON_UPLOAD_RATE_LIMIT_PER_WINDOW;
  private nextAvailableAt = 0;
  private readonly sleepFn: (ms: number) => Promise<void> = defaultSleep;

  getIntervalMs(): number {
    return this.intervalMs;
  }

  async waitForSlot(): Promise<void> {
    const now = Date.now();
    const waitMs = this.nextAvailableAt - now;
    this.nextAvailableAt = Math.max(now, this.nextAvailableAt) + this.intervalMs;

    if (waitMs > 0) {
      await this.sleepFn(waitMs);
    }
  }
}
