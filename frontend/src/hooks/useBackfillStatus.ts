import { useCallback, useEffect, useState } from 'react';
import { type BackfillStartResult, type BackfillStatus, getBackfillStatus, startBackfill } from '../api/activitiesApi';

const POLL_INTERVAL_MS = 5000;

export const useBackfillStatus = () => {
  const [status, setStatus] = useState<BackfillStatus | null>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await getBackfillStatus();
      setStatus(result);
      return result;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!status?.isRunning) {
      return;
    }

    const timer = setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [status?.isRunning, refresh]);

  const start = useCallback(async (): Promise<BackfillStartResult> => {
    const result = await startBackfill();
    await refresh();
    return result;
  }, [refresh]);

  return { status, start };
};
