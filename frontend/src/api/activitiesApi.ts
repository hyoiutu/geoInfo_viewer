import type { AppErrorInfo } from '../types/apiError';
import { buildApiError } from '../utils/apiError';

export type CyclingActivity = {
  id: string;
  name: string;
  distanceMeters: number;
  movingTimeSeconds: number;
  startDate: string;
  path: [number, number][] | null;
};

export type SyncResult = {
  success: boolean;
};

export type BackfillStartResult = {
  started: boolean;
};

export type BackfillStatus = {
  isRunning: boolean;
  totalCount: number;
  completedCount: number;
  progressPercent: number;
  estimatedRemainingSeconds: number | null;
  lastError: AppErrorInfo | null;
};

const BACKEND_BASE_URL = 'http://localhost:3000';
const ACTIVITIES_PATH = '/activities';
const ACTIVITIES_SYNC_PATH = '/activities/sync';
const ACTIVITIES_BACKFILL_PATH = '/activities/backfill';
const ACTIVITIES_BACKFILL_STATUS_PATH = '/activities/backfill/status';
const HTTP_METHOD_POST = 'POST';

export const fetchCyclingActivities = async (): Promise<CyclingActivity[]> => {
  const response = await fetch(`${BACKEND_BASE_URL}${ACTIVITIES_PATH}`);

  if (!response.ok) {
    throw await buildApiError(response);
  }

  return response.json();
};

// バックエンド側のisRunningガード（自転車ログ表示中に既にバックフィルが動いている場合）はエラーではなく
// success:falseで表現するため、それ以外の失敗（Strava APIエラー等）のみをApiErrorとして投げる。
export const syncCyclingActivities = async (): Promise<SyncResult> => {
  const response = await fetch(`${BACKEND_BASE_URL}${ACTIVITIES_SYNC_PATH}`, { method: HTTP_METHOD_POST });

  if (!response.ok) {
    throw await buildApiError(response);
  }

  return response.json();
};

export const startBackfill = async (): Promise<BackfillStartResult> => {
  const response = await fetch(`${BACKEND_BASE_URL}${ACTIVITIES_BACKFILL_PATH}`, { method: HTTP_METHOD_POST });

  if (!response.ok) {
    throw await buildApiError(response);
  }

  return response.json();
};

export const getBackfillStatus = async (): Promise<BackfillStatus> => {
  const response = await fetch(`${BACKEND_BASE_URL}${ACTIVITIES_BACKFILL_STATUS_PATH}`);

  if (!response.ok) {
    throw await buildApiError(response);
  }

  return response.json();
};
