import type { Feature, Point } from 'geojson';
import Supercluster from 'supercluster';
import type { Photo } from '../api/activitiesApi';
import { PHOTO_BALLOON_CLUSTER_MAX_ZOOM, PHOTO_BALLOON_CLUSTER_RADIUS_PX } from '../constants/photoBalloon';

/** クラスタリング対象の写真1件分（位置情報を持つもののみ）が持つプロパティ */
type PhotoPointProperties = {
  photoId: number;
  fileName: string;
};

/** buildPhotoClusterIndexの戻り値の型。地図の表示範囲・ズームレベルが変わるたびgetVisiblePhotoClustersへ渡す */
export type PhotoClusterIndex = Supercluster<PhotoPointProperties>;

/**
 * 写真一覧から、地図上の吹き出し表示用のクラスタリングインデックスを構築する。位置情報（GPS座標）を
 * 持たない写真は対象外とする（本当は撮影日時とアクティビティの軌跡から位置を補完したいが、アクティビティの
 * 各ポイントに時刻データが含まれていないため見送り、吹き出しとしては表示しない。Issue #107のユーザー回答）
 * @param photos 対象の写真一覧
 * @returns 構築済みのクラスタリングインデックス
 */
export const buildPhotoClusterIndex = (photos: Photo[]): PhotoClusterIndex => {
  const points: Feature<Point, PhotoPointProperties>[] = photos
    .filter((photo): photo is Photo & { location: Point } => photo.location !== null)
    .map((photo) => ({
      type: 'Feature',
      geometry: photo.location,
      properties: { photoId: photo.id, fileName: photo.fileName }
    }));

  const index = new Supercluster<PhotoPointProperties>({
    radius: PHOTO_BALLOON_CLUSTER_RADIUS_PX,
    maxZoom: PHOTO_BALLOON_CLUSTER_MAX_ZOOM
  });
  index.load(points);
  return index;
};

/** getVisiblePhotoClustersの戻り値1件分。クラスタ（近接する複数写真をまとめたもの）または個別の写真を表す */
export type PhotoBalloonPoint =
  | { type: 'cluster'; longitude: number; latitude: number; photoCount: number }
  | { type: 'single'; longitude: number; latitude: number; photoId: number; fileName: string };

/**
 * クラスタリングインデックスから、指定した表示範囲・ズームレベルで実際に表示すべきクラスタ・
 * 個別写真の一覧を求める
 * @param index buildPhotoClusterIndexで構築済みのインデックス
 * @param bbox 表示範囲（[西端経度, 南端緯度, 東端経度, 北端緯度]）
 * @param zoom ズームレベル
 * @returns 表示対象のクラスタ・個別写真の一覧
 */
export const getVisiblePhotoClusters = (
  index: PhotoClusterIndex,
  bbox: [number, number, number, number],
  zoom: number
): PhotoBalloonPoint[] =>
  index.getClusters(bbox, Math.floor(zoom)).map((feature) => {
    const [longitude, latitude] = feature.geometry.coordinates;
    if ('cluster' in feature.properties) {
      return { type: 'cluster', longitude, latitude, photoCount: feature.properties.point_count };
    }
    return {
      type: 'single',
      longitude,
      latitude,
      photoId: feature.properties.photoId,
      fileName: feature.properties.fileName
    };
  });
