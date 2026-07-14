import { useSetAtom } from 'jotai';
import { useCallback, useEffect, useState } from 'react';
import {
  type BackfillStartResult,
  type BackfillStatus,
  getBackfillStatus,
  startBackfill,
  startForceRefetch as startForceRefetchApi
} from '../api/activitiesApi';
import { addErrorAtom } from '../atoms/errorsAtom';
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
  /** 既存全アクティビティの強制再取得を開始する関数 */
  startForceRefetch: () => Promise<BackfillStartResult | null>;
};

/**
 * 初期取り込み(バックフィル)の進捗状況を取得・ポーリングし、開始操作を提供するフック。
 * 実行中は一定間隔で進捗状況を自動的に再取得する。エラーはグローバルなエラースタック（errorsAtom）へ報告する
 * @returns 進捗状況と開始関数
 */
export const useBackfillStatus = (): UseBackfillStatusResult => {
  const [backfillStatus, setBackfillStatus] = useState<BackfillStatus | null>(null);
  const addError = useSetAtom(addErrorAtom);

  const refresh = useCallback(async () => {
    try {
      const result = await getBackfillStatus();
      setBackfillStatus(result);
      // 初期取り込みはfire-and-forgetのため、発生したエラーはHTTPレスポンスの成否ではなく
      // レスポンスボディのlastErrorフィールドとして返ってくる。ポーリング側で明示的にチェックする。
      if (result.lastError !== null) {
        addError(result.lastError);
      }
      return result;
    } catch (error) {
      addError(toAppErrorInfo(error));
      return null;
    }
  }, [addError]);

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

  // start/startForceRefetchはバックエンド側で同じisRunningガードを共有するため、
  // 開始処理→進捗再取得の流れも共通化する
  const runStartAction = useCallback(
    async (action: () => Promise<BackfillStartResult>): Promise<BackfillStartResult | null> => {
      try {
        const result = await action();
        await refresh();
        return result;
      } catch (error) {
        addError(toAppErrorInfo(error));
        return null;
      }
    },
    [refresh, addError]
  );

  const start = useCallback(() => runStartAction(startBackfill), [runStartAction]);
  const startForceRefetch = useCallback(() => runStartAction(startForceRefetchApi), [runStartAction]);

  return { backfillStatus, start, startForceRefetch };
};
