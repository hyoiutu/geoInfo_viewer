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

const BACKEND_BASE_URL = 'http://localhost:3000';
const ACTIVITIES_PATH = '/activities';
const ACTIVITIES_SYNC_PATH = '/activities/sync';
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
