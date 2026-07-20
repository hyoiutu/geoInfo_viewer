import type { MultiPolygon, Polygon, Position } from 'geojson';

/** 1つのリング(閉じた座標配列)の符号付き面積(2倍値)と重心を、シューレース公式で算出する */
const calculateRingCentroid = (ring: Position[]): { doubleSignedArea: number; centroid: [number, number] } => {
  let doubleSignedArea = 0;
  let weightedX = 0;
  let weightedY = 0;

  for (let index = 0; index < ring.length - 1; index += 1) {
    const [x0, y0] = ring[index];
    const [x1, y1] = ring[index + 1];
    const cross = x0 * y1 - x1 * y0;
    doubleSignedArea += cross;
    weightedX += (x0 + x1) * cross;
    weightedY += (y0 + y1) * cross;
  }

  if (doubleSignedArea === 0) {
    const [firstX, firstY] = ring[0];
    return { doubleSignedArea: 0, centroid: [firstX, firstY] };
  }
  return {
    doubleSignedArea,
    centroid: [weightedX / (3 * doubleSignedArea), weightedY / (3 * doubleSignedArea)]
  };
};

/**
 * Polygon/MultiPolygonジオメトリの重心(面積で重み付けした中心点)を求める。緯度経度をそのまま平面座標と
 * みなす近似計算（行政区画フォーカス時の地図中心合わせに使う用途では十分な精度、Issue #80フォローアップ）。
 * 穴（内側のリング）は無視し、外側のリングのみで算出する（行政区画データに穴を持つケースは稀であり、
 * 重心の算出結果への影響も小さいため、簡略化している）。MultiPolygonの場合は各ポリゴンの面積で重み付けする
 * @param geometry 対象のPolygon/MultiPolygonジオメトリ
 * @returns 重心の座標([経度, 緯度])。全てのポリゴンの面積が0(縮退したジオメトリ)の場合はnull
 */
export const calculatePolygonCentroid = (geometry: Polygon | MultiPolygon): [number, number] | null => {
  const outerRings =
    geometry.type === 'Polygon' ? [geometry.coordinates[0]] : geometry.coordinates.map((polygon) => polygon[0]);

  let totalArea = 0;
  let weightedX = 0;
  let weightedY = 0;

  for (const ring of outerRings) {
    const { doubleSignedArea, centroid } = calculateRingCentroid(ring);
    const area = Math.abs(doubleSignedArea) / 2;
    if (area === 0) {
      continue;
    }
    totalArea += area;
    weightedX += centroid[0] * area;
    weightedY += centroid[1] * area;
  }

  if (totalArea === 0) {
    return null;
  }
  return [weightedX / totalArea, weightedY / totalArea];
};
