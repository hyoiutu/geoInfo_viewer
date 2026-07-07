export type CyclingActivityDto = {
  id: number;
  name: string;
  distanceMeters: number;
  movingTimeSeconds: number;
  startDate: string;
  path: [number, number][] | null;
};
