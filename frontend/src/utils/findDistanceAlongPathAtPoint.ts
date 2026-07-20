const EARTH_RADIUS_METERS = 6371000;
const DEGREES_TO_RADIANS = Math.PI / 180;
const MIN_POINTS_FOR_SEGMENT = 2;

/**
 * 度をラジアンに変換する
 * @param degrees 度
 * @returns ラジアン
 */
const toRadians = (degrees: number): number => degrees * DEGREES_TO_RADIANS;

/**
 * 2点間の大圏距離(メートル)をHaversine公式で算出する。
 * バックエンドの`splitPathAtJumps`が持つ同名の実装と同じ計算式だが、フロントエンド・バックエンド間で
 * コードを共有する仕組みがこのプロジェクトに無いため、既存の慣例（各パッケージが必要な分だけ持つ）に倣い個別に持つ
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
 * 対象の点から線分(segStart→segEnd)への最近点を求める。緯度経度をそのまま平面座標とみなす近似
 * （ホバー表示の精度としては十分であり、正確な測地線上の最近点計算は行わない）
 * @param point 対象の点([経度, 緯度])
 * @param segStart 線分の始点([経度, 緯度])
 * @param segEnd 線分の終点([経度, 緯度])
 * @returns 線分上の最近点と、線分に対する位置(0=始点、1=終点)
 */
const projectPointOnSegment = (
  point: [number, number],
  segStart: [number, number],
  segEnd: [number, number]
): { nearestPoint: [number, number]; fraction: number } => {
  const [px, py] = point;
  const [ax, ay] = segStart;
  const [bx, by] = segEnd;
  const abx = bx - ax;
  const aby = by - ay;
  const abLengthSquared = abx * abx + aby * aby;
  if (abLengthSquared === 0) {
    return { nearestPoint: segStart, fraction: 0 };
  }

  const apx = px - ax;
  const apy = py - ay;
  const rawFraction = (apx * abx + apy * aby) / abLengthSquared;
  const fraction = Math.min(1, Math.max(0, rawFraction));
  return { nearestPoint: [ax + abx * fraction, ay + aby * fraction], fraction };
};

/**
 * 軌跡(MultiLineString、位置飛びで分割済みの区間グループの配列)上で、指定した点に最も近い点までの
 * 軌跡に沿った距離(メートル、始点からの累積距離)を求める。区間グループ間（位置飛びの箇所）の距離は
 * 実際には走行していない区間のため累積距離に含めない
 * @param path 対象の軌跡（区間グループごとの[経度, 緯度]配列）
 * @param point 距離を求めたい点([経度, 緯度]。地図クリック/ホバー地点等)
 * @returns 軌跡の始点から最近点までの累積距離(メートル)。軌跡が空の場合はnull
 */
export const findDistanceAlongPathAtPoint = (path: [number, number][][], point: [number, number]): number | null => {
  let bestDistanceToPointMeters = Number.POSITIVE_INFINITY;
  let bestCumulativeDistanceMeters: number | null = null;
  let cumulativeDistanceBeforeGroupMeters = 0;

  for (const segmentGroup of path) {
    if (segmentGroup.length < MIN_POINTS_FOR_SEGMENT) {
      continue;
    }

    let cumulativeWithinGroupMeters = 0;
    for (let index = 0; index < segmentGroup.length - 1; index += 1) {
      const segStart = segmentGroup[index];
      const segEnd = segmentGroup[index + 1];
      const segmentLengthMeters = haversineDistanceMeters(segStart, segEnd);

      const { nearestPoint, fraction } = projectPointOnSegment(point, segStart, segEnd);
      const distanceToPointMeters = haversineDistanceMeters(point, nearestPoint);
      if (distanceToPointMeters < bestDistanceToPointMeters) {
        bestDistanceToPointMeters = distanceToPointMeters;
        bestCumulativeDistanceMeters =
          cumulativeDistanceBeforeGroupMeters + cumulativeWithinGroupMeters + segmentLengthMeters * fraction;
      }

      cumulativeWithinGroupMeters += segmentLengthMeters;
    }
    cumulativeDistanceBeforeGroupMeters += cumulativeWithinGroupMeters;
  }

  return bestCumulativeDistanceMeters;
};
