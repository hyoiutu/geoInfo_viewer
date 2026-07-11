import { Injectable } from '@nestjs/common';
import { STRAVA_NON_UPLOAD_RATE_LIMIT_PER_WINDOW, STRAVA_NON_UPLOAD_RATE_LIMIT_WINDOW_MS } from './strava.constants';

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class StravaRateLimiterService {
  // E2Eテストではバックフィルの待機時間を実用的な長さに抑えるため環境変数で上書き可能にしている
  // （通常は未設定でStravaの実レート制限に基づく間隔を使う）。
  private readonly intervalMs =
    Number(process.env.STRAVA_RATE_LIMIT_INTERVAL_MS) ||
    STRAVA_NON_UPLOAD_RATE_LIMIT_WINDOW_MS / STRAVA_NON_UPLOAD_RATE_LIMIT_PER_WINDOW;
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
