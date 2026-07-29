import { useSetAtom } from 'jotai';
import { useEffect, useRef, useState } from 'react';
import {
  type CyclingActivity,
  fetchCyclingActivities,
  getBackfillStatus,
  type SyncResult,
  syncCyclingActivities
} from '../api/activitiesApi';
import { addErrorAtom } from '../atoms/errorsAtom';
import type { AppErrorInfo } from '../types/apiError';
import { toAppErrorInfo } from '../utils/apiError';

/** useCyclingActivitiesの戻り値 */
type UseCyclingActivitiesResult = {
  /** DBに保存済みの自転車ログ（サイクリングアクティビティ）一覧 */
  activities: CyclingActivity[];
};

/**
 * Strava上の新規アクティビティを取得し、取得したアクティビティ一覧をコールバックで通知する。
 * 地図への反映（フィルタ適用後のGeoJSON設定）はこの関数の呼び出し元が別途行う。
 * 成功・失敗に関わらず、完了時に必ずonSyncCompleteを呼ぶ（Issue #65。呼び出し元がレイヤーダイアログの
 * ローディング状態を解除するタイミングとして使うため、エラー時に呼ばれないとダイアログが閉じなくなる）
 * @param onError API呼び出し失敗時に呼ばれるコールバック
 * @param onActivitiesLoaded 取得に成功したアクティビティ一覧を渡すコールバック
 * @param onSyncComplete 成功・失敗に関わらず、一連の処理が完了した時点で呼ばれるコールバック
 */
const syncAndLoadBicycleLog = async (
  onError: (error: AppErrorInfo) => void,
  onActivitiesLoaded: (activities: CyclingActivity[]) => void,
  onSyncComplete: () => void
) => {
  try {
    // バックフィル実行中は新規アクティビティ取得を呼ばず、その時点でDBに取得済みの分だけ表示する
    const backfillStatus = await getBackfillStatus().catch(() => null);
    if (!backfillStatus?.isRunning) {
      let syncResult: SyncResult;
      try {
        syncResult = await syncCyclingActivities();
      } catch (error) {
        onError(toAppErrorInfo(error));
        return;
      }
      // success:falseはバックエンド側の「バックフィル実行中ガード」を踏んだ場合のみ返る（レースコンディション）。
      // エラーではないため、静かに（ダイアログ無しで）参照APIの呼び出しをスキップする
      if (!syncResult.success) {
        return;
      }
    }

    try {
      const activities = await fetchCyclingActivities();
      onActivitiesLoaded(activities);
    } catch (error) {
      onError(toAppErrorInfo(error));
    }
  } finally {
    onSyncComplete();
  }
};

/**
 * 自転車ログレイヤーがOFF→ONに変化するたびに、Strava新規アクティビティ取得・DBからの参照取得を行い、
 * 取得済みの全アクティビティ一覧を保持するフック。地図への表示反映・フィルタ適用は呼び出し元が別途行う（Issue #58）
 * @param isBicycleLogVisible 自転車ログレイヤーが表示中かどうか
 * @param onSyncComplete OFF→ONによる同期・参照取得が完了した時点（成功・失敗問わず）で呼ばれるコールバック。
 * レイヤーダイアログのローディング状態解除に使う（Issue #65）
 * @returns 取得済みの全アクティビティ一覧
 */
export const useCyclingActivities = (
  isBicycleLogVisible: boolean,
  onSyncComplete?: () => void
): UseCyclingActivitiesResult => {
  const addError = useSetAtom(addErrorAtom);
  const [activities, setActivities] = useState<CyclingActivity[]>([]);
  const wasBicycleLogVisibleRef = useRef(false);
  // 呼び出し元(MapWorkspace)の再レンダリングのたびにonSyncCompleteの関数参照が変わりうるため、
  // 依存配列に含めてeffectを不要に再実行しないよう、最新の値をrefで参照する
  const onSyncCompleteRef = useRef(onSyncComplete);
  onSyncCompleteRef.current = onSyncComplete;

  // 自転車ログレイヤーがOFF→ONに変化した場合のみ、Strava新規アクティビティ取得・参照取得を行う
  useEffect(() => {
    const wasBicycleLogVisible = wasBicycleLogVisibleRef.current;
    wasBicycleLogVisibleRef.current = isBicycleLogVisible;

    if (!wasBicycleLogVisible && isBicycleLogVisible) {
      void syncAndLoadBicycleLog(addError, setActivities, () => onSyncCompleteRef.current?.());
    }
  }, [isBicycleLogVisible, addError]);

  return { activities };
};
