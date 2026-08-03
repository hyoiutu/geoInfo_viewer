import { useCallback, useEffect, useState } from 'react';
import type { BackfillStatus } from '../api/activitiesApi';

/** useBackfillProgressFooterの戻り値 */
type UseBackfillProgressFooterResult = {
  /** 進捗フッターを表示するかどうか */
  isVisible: boolean;
  /** フッターを表示する（初期取り込み・強制再取得の開始操作と同時に呼ぶ） */
  show: () => void;
  /** フッターを閉じる（次に実行が開始されるまで再表示されない） */
  dismiss: () => void;
};

/**
 * 初期取り込み(バックフィル)進捗フッターの表示状態を管理するフック。
 * 実行が開始されると表示され、完了後もユーザーがdismissを呼ぶまで表示され続ける。
 * 表示のトリガーは`backfillStatus?.isRunning`の観測ではなく、呼び出し元が開始操作と同時に呼ぶ`show`とする
 * （対象件数が極端に少ない・レート制限間隔が極小の環境では、開始直後の最初の状態取得時点で既に完了しており、
 * isRunning:trueの状態をフロントエンドが一度も観測できない競合が起きうる。実際にE2Eテストで
 * 断続的に発生し、進捗フッターが最後まで表示されない不具合として顕在化した。Issue #86）
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

  const show = useCallback(() => {
    setDismissed(false);
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  return { isVisible: !dismissed, show, dismiss };
};
