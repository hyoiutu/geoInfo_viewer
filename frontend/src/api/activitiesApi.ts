export type CyclingActivity = {
  id: number;
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
    throw new Error(`アクティビティの取得に失敗しました (status: ${response.status})`);
  }

  return response.json();
};

export const syncCyclingActivities = async (): Promise<SyncResult> => {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}${ACTIVITIES_SYNC_PATH}`, { method: HTTP_METHOD_POST });

    if (!response.ok) {
      return { success: false };
    }

    return await response.json();
  } catch {
    return { success: false };
  }
};

export const startBackfill = async (): Promise<BackfillStartResult> => {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}${ACTIVITIES_BACKFILL_PATH}`, { method: HTTP_METHOD_POST });

    if (!response.ok) {
      return { started: false };
    }

    return await response.json();
  } catch {
    return { started: false };
  }
};

export const getBackfillStatus = async (): Promise<BackfillStatus> => {
  const response = await fetch(`${BACKEND_BASE_URL}${ACTIVITIES_BACKFILL_STATUS_PATH}`);

  if (!response.ok) {
    throw new Error(`初期取り込み状況の取得に失敗しました (status: ${response.status})`);
  }

  return response.json();
};
