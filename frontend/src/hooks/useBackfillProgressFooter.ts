import { useCallback, useEffect, useState } from 'react';
import type { BackfillStatus } from '../api/activitiesApi';

/** useBackfillProgressFooterの戻り値 */
type UseBackfillProgressFooterResult = {
  /** 進捗フッターを表示するかどうか */
  isVisible: boolean;
  /** フッターを閉じる（次に実行が開始されるまで再表示されない） */
  dismiss: () => void;
};

/**
 * 初期取り込み(バックフィル)進捗フッターの表示状態を管理するフック。
 * 実行が開始されると表示され、完了後もユーザーがdismissを呼ぶまで表示され続ける
 * @param backfillStatus 現在の初期取り込み進捗状況。未取得の間はnull
 * @returns フッターの表示状態と操作関数
 */
export const useBackfillProgressFooter = (backfillStatus: BackfillStatus | null): UseBackfillProgressFooterResult => {
  const [dismissed, setDismissed] = useState(true);

  // 実行が開始されるたびに、前回dismissされていても再表示する
  useEffect(() => {
    if (backfillStatus?.isRunning) {
      setDismissed(false);
    }
  }, [backfillStatus?.isRunning]);

  const dismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  return { isVisible: !dismissed, dismiss };
};
