import type { AppErrorInfo } from '../types/apiError';
import { buildApiError } from '../utils/apiError';

/** 自転車ログ（アクティビティ）1件分 */
export type CyclingActivity = {
  /** StravaのアクティビティID */
  id: string;
  /** アクティビティ名 */
  name: string;
  /** 走行距離（メートル） */
  distanceMeters: number;
  /** 走行時間（秒、停止時間を含まない） */
  movingTimeSeconds: number;
  /** 経過時間（秒、停止時間を含む。開始日時に加算すると終了日時になる） */
  elapsedTimeSeconds: number;
  /** 獲得標高（メートル） */
  elevationGainMeters: number;
  /** 開始日時（ISO 8601形式の文字列） */
  startDate: string;
  /** 軌跡（経度・緯度の配列）。GPSルートの無いアクティビティの場合はnull */
  path: [number, number][] | null;
};

/** syncCyclingActivitiesの実行結果 */
export type SyncResult = {
  /** 同期処理が実行されたか（バックフィル実行中ガードでスキップした場合はfalse。実際のエラーは例外として投げられる） */
  success: boolean;
};

/** startBackfillの実行結果 */
export type BackfillStartResult = {
  /** 新たに初期取り込みを開始したか（既に実行中だった場合はfalse） */
  started: boolean;
};

/** getBackfillStatusが返す初期取り込みの進捗状況 */
export type BackfillStatus = {
  /** 現在実行中かどうか */
  isRunning: boolean;
  /** DBに存在するアクティビティの総数 */
  totalCount: number;
  /** うち詳細取得が完了した件数 */
  completedCount: number;
  /** 進捗率（%） */
  progressPercent: number;
  /** 完了までの推定残り秒数。実行中でない場合はnull */
  estimatedRemainingSeconds: number | null;
  /** 直近の実行で発生したエラー。発生していない場合はnull */
  lastError: AppErrorInfo | null;
};

const BACKEND_BASE_URL = 'http://localhost:3000';
const ACTIVITIES_PATH = '/activities';
const ACTIVITIES_SYNC_PATH = '/activities/sync';
const ACTIVITIES_BACKFILL_PATH = '/activities/backfill';
const ACTIVITIES_BACKFILL_STATUS_PATH = '/activities/backfill/status';
const ACTIVITIES_BACKFILL_FORCE_REFETCH_PATH = '/activities/backfill/force-refetch';
const HTTP_METHOD_POST = 'POST';

/**
 * DBに保存済みの自転車ログ一覧を取得する
 * @returns 自転車ログ一覧
 */
export const fetchCyclingActivities = async (): Promise<CyclingActivity[]> => {
  const response = await fetch(`${BACKEND_BASE_URL}${ACTIVITIES_PATH}`);

  if (!response.ok) {
    throw await buildApiError(response);
  }

  return response.json();
};

/**
 * Strava上の新規アクティビティを取得しDBへ反映する。
 * バックエンド側のisRunningガード（自転車ログ表示中に既にバックフィルが動いている場合）はエラーではなく
 * success:falseで表現するため、それ以外の失敗（Strava APIエラー等）のみをApiErrorとして投げる。
 * @returns 同期結果
 */
export const syncCyclingActivities = async (): Promise<SyncResult> => {
  const response = await fetch(`${BACKEND_BASE_URL}${ACTIVITIES_SYNC_PATH}`, { method: HTTP_METHOD_POST });

  if (!response.ok) {
    throw await buildApiError(response);
  }

  return response.json();
};

/**
 * 初期取り込み(バックフィル)を開始する
 * @returns 開始結果
 */
export const startBackfill = async (): Promise<BackfillStartResult> => {
  const response = await fetch(`${BACKEND_BASE_URL}${ACTIVITIES_BACKFILL_PATH}`, { method: HTTP_METHOD_POST });

  if (!response.ok) {
    throw await buildApiError(response);
  }

  return response.json();
};

/**
 * 既存全アクティビティの詳細を、detailFetchedAtの状態にかかわらず強制的に再取得する。
 * 初期取り込み(バックフィル)とisRunningガードを共有するため、どちらか一方が実行中はもう一方を開始できない。
 * @returns 開始結果
 */
export const startForceRefetch = async (): Promise<BackfillStartResult> => {
  const response = await fetch(`${BACKEND_BASE_URL}${ACTIVITIES_BACKFILL_FORCE_REFETCH_PATH}`, {
    method: HTTP_METHOD_POST
  });

  if (!response.ok) {
    throw await buildApiError(response);
  }

  return response.json();
};

/**
 * 初期取り込み(バックフィル)の進捗状況を取得する
 * @returns 進捗状況
 */
export const getBackfillStatus = async (): Promise<BackfillStatus> => {
  const response = await fetch(`${BACKEND_BASE_URL}${ACTIVITIES_BACKFILL_STATUS_PATH}`);

  if (!response.ok) {
    throw await buildApiError(response);
  }

  return response.json();
};
