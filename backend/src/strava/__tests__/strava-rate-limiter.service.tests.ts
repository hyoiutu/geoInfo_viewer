import { afterEach, describe, expect, test, vi } from 'vitest';
import { STRAVA_NON_UPLOAD_RATE_LIMIT_PER_WINDOW, STRAVA_NON_UPLOAD_RATE_LIMIT_WINDOW_MS } from '../strava.constants';
import { StravaRateLimiterService } from '../strava-rate-limiter.service';

describe('StravaRateLimiterServiceに関するテスト', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('getIntervalMsは、レート制限のウィンドウを上限リクエスト数で割った間隔を返す', () => {
    const service = new StravaRateLimiterService();

    expect(service.getIntervalMs()).toBe(
      STRAVA_NON_UPLOAD_RATE_LIMIT_WINDOW_MS / STRAVA_NON_UPLOAD_RATE_LIMIT_PER_WINDOW
    );
  });

  test('初回のwaitForSlotは待機しない', async () => {
    const service = new StravaRateLimiterService();
    const sleepFn = vi.fn().mockResolvedValue(undefined);
    // biome-ignore lint/suspicious/noExplicitAny: privateなsleepFnをテストのために差し替える
    (service as any).sleepFn = sleepFn;
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000);

    await service.waitForSlot();

    expect(sleepFn).not.toHaveBeenCalled();
  });

  test('間隔内に連続してwaitForSlotを呼ぶと、次のリクエストは間隔分待機する', async () => {
    const service = new StravaRateLimiterService();
    const sleepFn = vi.fn().mockResolvedValue(undefined);
    // biome-ignore lint/suspicious/noExplicitAny: privateなsleepFnをテストのために差し替える
    (service as any).sleepFn = sleepFn;
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);

    await service.waitForSlot();
    nowSpy.mockReturnValue(1_000_100);
    await service.waitForSlot();

    expect(sleepFn).toHaveBeenCalledWith(service.getIntervalMs() - 100);
  });

  test('間隔以上の時間が経過していれば待機しない', async () => {
    const service = new StravaRateLimiterService();
    const sleepFn = vi.fn().mockResolvedValue(undefined);
    // biome-ignore lint/suspicious/noExplicitAny: privateなsleepFnをテストのために差し替える
    (service as any).sleepFn = sleepFn;
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);

    await service.waitForSlot();
    nowSpy.mockReturnValue(1_000_000 + service.getIntervalMs() + 1);
    await service.waitForSlot();

    expect(sleepFn).not.toHaveBeenCalled();
  });
});
