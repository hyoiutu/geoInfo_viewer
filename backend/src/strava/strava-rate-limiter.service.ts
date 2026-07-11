import { Injectable } from '@nestjs/common';
import { STRAVA_NON_UPLOAD_RATE_LIMIT_PER_WINDOW, STRAVA_NON_UPLOAD_RATE_LIMIT_WINDOW_MS } from './strava.constants';

/**
 * 指定したミリ秒だけ待機する
 * @param ms 待機時間（ミリ秒）
 */
const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Strava APIのレート制限を守るため、リクエスト間隔を一定に保つサービス */
@Injectable()
export class StravaRateLimiterService {
  // E2Eテストではバックフィルの待機時間を実用的な長さに抑えるため環境変数で上書き可能にしている
  // （通常は未設定でStravaの実レート制限に基づく間隔を使う）。
  private readonly intervalMs =
    Number(process.env.STRAVA_RATE_LIMIT_INTERVAL_MS) ||
    STRAVA_NON_UPLOAD_RATE_LIMIT_WINDOW_MS / STRAVA_NON_UPLOAD_RATE_LIMIT_PER_WINDOW;
  private nextAvailableAt = 0;
  private readonly sleepFn: (ms: number) => Promise<void> = defaultSleep;

  /** @returns リクエスト間の最小間隔（ミリ秒） */
  getIntervalMs(): number {
    return this.intervalMs;
  }

  /** 前回のリクエストから最小間隔が経過するまで待機する */
  async waitForSlot(): Promise<void> {
    const now = Date.now();
    const waitMs = this.nextAvailableAt - now;
    this.nextAvailableAt = Math.max(now, this.nextAvailableAt) + this.intervalMs;

    if (waitMs > 0) {
      await this.sleepFn(waitMs);
    }
  }
}
