export type CyclingActivityDto = {
  id: string;
  name: string;
  distanceMeters: number;
  movingTimeSeconds: number;
  startDate: string;
  path: [number, number][] | null;
};
