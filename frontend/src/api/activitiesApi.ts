export type CyclingActivity = {
  id: number;
  name: string;
  distanceMeters: number;
  movingTimeSeconds: number;
  startDate: string;
  path: [number, number][] | null;
};

const BACKEND_BASE_URL = 'http://localhost:3000';
const ACTIVITIES_PATH = '/activities';

export const fetchCyclingActivities = async (): Promise<CyclingActivity[]> => {
  const response = await fetch(`${BACKEND_BASE_URL}${ACTIVITIES_PATH}`);

  if (!response.ok) {
    throw new Error(`アクティビティの取得に失敗しました (status: ${response.status})`);
  }

  return response.json();
};
