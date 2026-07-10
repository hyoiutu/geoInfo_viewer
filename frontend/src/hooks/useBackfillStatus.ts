import { useCallback, useEffect, useState } from 'react';
import { type BackfillStartResult, type BackfillStatus, getBackfillStatus, startBackfill } from '../api/activitiesApi';

const POLL_INTERVAL_MS = 5000;

export const useBackfillStatus = () => {
  const [backfillStatus, setBackfillStatus] = useState<BackfillStatus | null>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await getBackfillStatus();
      setBackfillStatus(result);
      return result;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!backfillStatus?.isRunning) {
      return;
    }

    const timer = setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [backfillStatus?.isRunning, refresh]);

  const start = useCallback(async (): Promise<BackfillStartResult> => {
    const result = await startBackfill();
    await refresh();
    return result;
  }, [refresh]);

  return { backfillStatus, start };
};
