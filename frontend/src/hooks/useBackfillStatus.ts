import { useCallback, useEffect, useState } from 'react';
import { type BackfillStartResult, type BackfillStatus, getBackfillStatus, startBackfill } from '../api/activitiesApi';
import type { AppErrorInfo } from '../types/apiError';
import { toAppErrorInfo } from '../utils/apiError';

// バックフィル進捗表示(%・残り時間)をUI上でどのくらいの頻度で更新するかの間隔。
// Strava APIのレート制限に合わせた9秒間隔（backend/src/strava/strava-rate-limiter.service.ts参照）とは無関係で、
// 進捗表示が数秒ごとに更新されれば体感上十分という判断で決めた値。
const BACKFILL_STATUS_POLL_INTERVAL_MS = 5000;

/** useBackfillStatusの戻り値 */
type UseBackfillStatusResult = {
  /** 現在の初期取り込み進捗状況（未取得の間はnull） */
  backfillStatus: BackfillStatus | null;
  /** 初期取り込みを開始する関数 */
  start: () => Promise<BackfillStartResult | null>;
};

/**
 * 初期取り込み(バックフィル)の進捗状況を取得・ポーリングし、開始操作を提供するフック。
 * 実行中は一定間隔で進捗状況を自動的に再取得する
 * @param onError APIエラー発生時に呼ばれるコールバック
 * @returns 進捗状況と開始関数
 */
export const useBackfillStatus = (onError?: (error: AppErrorInfo) => void): UseBackfillStatusResult => {
  const [backfillStatus, setBackfillStatus] = useState<BackfillStatus | null>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await getBackfillStatus();
      setBackfillStatus(result);
      // 初期取り込みはfire-and-forgetのため、発生したエラーはHTTPレスポンスの成否ではなく
      // レスポンスボディのlastErrorフィールドとして返ってくる。ポーリング側で明示的にチェックする。
      if (result.lastError !== null) {
        onError?.(result.lastError);
      }
      return result;
    } catch (error) {
      onError?.(toAppErrorInfo(error));
      return null;
    }
  }, [onError]);

  // マウント時に一度だけ現在の進捗状況を取得する
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // 実行中の間だけ、一定間隔で進捗状況をポーリングして再取得する
  useEffect(() => {
    if (!backfillStatus?.isRunning) {
      return;
    }

    const timer = setInterval(() => {
      void refresh();
    }, BACKFILL_STATUS_POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [backfillStatus?.isRunning, refresh]);

  const start = useCallback(async (): Promise<BackfillStartResult | null> => {
    try {
      const result = await startBackfill();
      await refresh();
      return result;
    } catch (error) {
      onError?.(toAppErrorInfo(error));
      return null;
    }
  }, [refresh, onError]);

  return { backfillStatus, start };
};
