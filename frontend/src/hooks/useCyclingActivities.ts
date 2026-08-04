import { useSetAtom } from 'jotai';
import { useState } from 'react';
import {
  type CyclingActivity,
  fetchCyclingActivities,
  getBackfillStatus,
  type SyncResult,
  syncCyclingActivities
} from '../api/activitiesApi';
import { addErrorAtom } from '../atoms/errorsAtom';
import { toAppErrorInfo } from '../utils/apiError';

/** useCyclingActivitiesの戻り値 */
type UseCyclingActivitiesResult = {
  /** DBに保存済みの自転車ログ（サイクリングアクティビティ）一覧 */
  activities: CyclingActivity[];
  /**
   * Strava上の新規アクティビティを取得し、DBから参照取得して保持済みのactivitiesを更新する。
   * 実行タイミングの判断（自転車ログレイヤーのOFF→ON検知）は呼び出し元が行う（Issue #125。
   * 以前はこのフック内部のuseEffectがOFF→ON変化を独自に検知していたが、呼び出し元
   * （MapWorkspaceのhandleApplyLayerSettings）が既にresolveLayerSettingsChangeで同じ判定を
   * 行っており、判定ロジックが重複していたため呼び出し元へ一本化した）
   */
  syncAndLoadBicycleLog: () => Promise<void>;
};

/**
 * 自転車ログ（サイクリングアクティビティ）を取得・保持するフック。地図への表示反映・フィルタ適用は
 * 呼び出し元が別途行う（Issue #58, #125）
 * @param onSyncComplete 成功・失敗に関わらず、一連の処理が完了した時点で呼ばれるコールバック。
 * レイヤーダイアログのローディング状態解除に使う（Issue #65）
 * @returns 取得済みの全アクティビティ一覧・同期実行関数
 */
export const useCyclingActivities = (onSyncComplete?: () => void): UseCyclingActivitiesResult => {
  const addError = useSetAtom(addErrorAtom);
  const [activities, setActivities] = useState<CyclingActivity[]>([]);

  const syncAndLoadBicycleLog = async () => {
    try {
      // バックフィル実行中は新規アクティビティ取得を呼ばず、その時点でDBに取得済みの分だけ表示する
      const backfillStatus = await getBackfillStatus().catch(() => null);
      if (!backfillStatus?.isRunning) {
        let syncResult: SyncResult;
        try {
          syncResult = await syncCyclingActivities();
        } catch (error) {
          addError(toAppErrorInfo(error));
          return;
        }
        // success:falseはバックエンド側の「バックフィル実行中ガード」を踏んだ場合のみ返る（レースコンディション）。
        // エラーではないため、静かに（ダイアログ無しで）参照APIの呼び出しをスキップする
        if (!syncResult.success) {
          return;
        }
      }

      try {
        const fetchedActivities = await fetchCyclingActivities();
        setActivities(fetchedActivities);
      } catch (error) {
        addError(toAppErrorInfo(error));
      }
    } finally {
      onSyncComplete?.();
    }
  };

  return { activities, syncAndLoadBicycleLog };
};
