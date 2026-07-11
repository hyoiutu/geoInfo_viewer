import { useCallback, useEffect, useState } from 'react';
import { type BackfillStartResult, type BackfillStatus, getBackfillStatus, startBackfill } from '../api/activitiesApi';
import type { AppErrorInfo } from '../types/apiError';
import { toAppErrorInfo } from '../utils/apiError';

// バックフィル進捗表示(%・残り時間)をUI上でどのくらいの頻度で更新するかの間隔。
// Strava APIのレート制限に合わせた9秒間隔（backend/src/strava/strava-rate-limiter.service.ts参照）とは無関係で、
// 進捗表示が数秒ごとに更新されれば体感上十分という判断で決めた値。
const BACKFILL_STATUS_POLL_INTERVAL_MS = 5000;

export const useBackfillStatus = (onError?: (error: AppErrorInfo) => void) => {
  const [backfillStatus, setBackfillStatus] = useState<BackfillStatus | null>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await getBackfillStatus();
      setBackfillStatus(result);
      return result;
    } catch (error) {
      onError?.(toAppErrorInfo(error));
      return null;
    }
  }, [onError]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
