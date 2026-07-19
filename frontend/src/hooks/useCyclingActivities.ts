import { useEffect, useRef, useState } from 'react';
import {
  type CyclingActivity,
  fetchCyclingActivities,
  getBackfillStatus,
  type SyncResult,
  syncCyclingActivities
} from '../api/activitiesApi';
import type { AppErrorInfo } from '../types/apiError';
import { toAppErrorInfo } from '../utils/apiError';
import { useErrorReporter } from './useErrorReporter';

/** useCyclingActivitiesの戻り値 */
type UseCyclingActivitiesResult = {
  /** DBに保存済みの自転車ログ（サイクリングアクティビティ）一覧 */
  activities: CyclingActivity[];
};

/**
 * Strava上の新規アクティビティを取得し、取得したアクティビティ一覧をコールバックで通知する。
 * 地図への反映（フィルタ適用後のGeoJSON設定）はこの関数の呼び出し元が別途行う
 * @param onError API呼び出し失敗時に呼ばれるコールバック
 * @param onActivitiesLoaded 取得に成功したアクティビティ一覧を渡すコールバック
 */
const syncAndLoadBicycleLog = async (
  onError: (error: AppErrorInfo) => void,
  onActivitiesLoaded: (activities: CyclingActivity[]) => void
) => {
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
};

/**
 * 自転車ログレイヤーがOFF→ONに変化するたびに、Strava新規アクティビティ取得・DBからの参照取得を行い、
 * 取得済みの全アクティビティ一覧を保持するフック。地図への表示反映・フィルタ適用は呼び出し元が別途行う（Issue #58）
 * @param isBicycleLogVisible 自転車ログレイヤーが表示中かどうか
 * @returns 取得済みの全アクティビティ一覧
 */
export const useCyclingActivities = (isBicycleLogVisible: boolean): UseCyclingActivitiesResult => {
  const addError = useErrorReporter();
  const [activities, setActivities] = useState<CyclingActivity[]>([]);
  const wasBicycleLogVisibleRef = useRef(false);

  // 自転車ログレイヤーがOFF→ONに変化した場合のみ、Strava新規アクティビティ取得・参照取得を行う
  useEffect(() => {
    const wasBicycleLogVisible = wasBicycleLogVisibleRef.current;
    wasBicycleLogVisibleRef.current = isBicycleLogVisible;

    if (!wasBicycleLogVisible && isBicycleLogVisible) {
      void syncAndLoadBicycleLog(addError, setActivities);
    }
  }, [isBicycleLogVisible, addError]);

  return { activities };
};
