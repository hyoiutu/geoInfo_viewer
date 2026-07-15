const EARTH_RADIUS_METERS = 6371000;
const DEGREES_TO_RADIANS = Math.PI / 180;
const JUMP_THRESHOLD_METERS = 10000;
const MIN_POINTS_FOR_LINE = 2;

/**
 * 度をラジアンに変換する
 * @param degrees 度
 * @returns ラジアン
 */
const toRadians = (degrees: number): number => degrees * DEGREES_TO_RADIANS;

/**
 * 2点間の大圏距離(メートル)をHaversine公式で算出する
 * @param a 1点目の座標([経度, 緯度])
 * @param b 2点目の座標([経度, 緯度])
 * @returns 2点間の距離(メートル)
 */
const haversineDistanceMeters = (a: [number, number], b: [number, number]): number => {
  const [lngA, latA] = a;
  const [lngB, latB] = b;
  const deltaLat = toRadians(latB - latA);
  const deltaLng = toRadians(lngB - lngA);
  const sinHalfDeltaLat = Math.sin(deltaLat / 2);
  const sinHalfDeltaLng = Math.sin(deltaLng / 2);
  const h = sinHalfDeltaLat ** 2 + Math.cos(toRadians(latA)) * Math.cos(toRadians(latB)) * sinHalfDeltaLng ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
};

/**
 * 軌跡(GPSトラック)を、隣接する2点間の距離が10km以上離れている箇所（トンネル内の測定不能区間・
 * フェリー乗船中の未計測区間等による位置飛び）で複数の区間に分割する。
 * 分割後、2点未満（線を描画できない孤立した1点）になった区間は除外する
 * @param path 分割対象の軌跡（[経度, 緯度]の配列、時系列順）
 * @returns 位置飛びで分割された区間の配列（各区間は2点以上の座標配列）
 */
export const splitPathAtJumps = (path: [number, number][]): [number, number][][] => {
  if (path.length === 0) {
    return [];
  }

  const segments: [number, number][][] = [];
  let currentSegment: [number, number][] = [path[0]];

  for (let index = 1; index < path.length; index += 1) {
    const previousPoint = path[index - 1];
    const currentPoint = path[index];
    if (haversineDistanceMeters(previousPoint, currentPoint) >= JUMP_THRESHOLD_METERS) {
      segments.push(currentSegment);
      currentSegment = [currentPoint];
    } else {
      currentSegment.push(currentPoint);
    }
  }
  segments.push(currentSegment);

  return segments.filter((segment) => segment.length >= MIN_POINTS_FOR_LINE);
};
