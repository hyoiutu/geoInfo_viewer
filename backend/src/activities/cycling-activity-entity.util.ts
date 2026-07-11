import polyline from '@mapbox/polyline';
import type { StravaActivity, StravaActivityDetail } from '../strava/types/strava-activity.type';
import { CyclingActivityEntity } from './entities/cycling-activity.entity';

const EMPTY_POLYLINE = '';

/**
 * エンコード済みポリラインを緯度経度の配列（[経度, 緯度]の順）にデコードする
 * @param encodedPolyline Google polyline形式でエンコードされた文字列（空文字の場合はnullを返す）
 * @returns デコードした座標配列。空文字の場合はnull
 */
const decodePolylineToPath = (encodedPolyline: string): [number, number][] | null => {
  if (encodedPolyline === EMPTY_POLYLINE) {
    return null;
  }

  return polyline.decode(encodedPolyline).map(([latitude, longitude]) => [longitude, latitude]);
};

/**
 * Strava側の共通フィールド（一覧API・詳細APIどちらにも存在するもの）をEntityへ詰め替える
 * @param activity 変換元のStravaアクティビティ（一覧APIまたは詳細APIのレスポンス）
 * @param entity 詰め替え先のEntity
 * @returns フィールドを詰め替えたEntity
 */
const mapBaseFields = (
  activity: StravaActivity | StravaActivityDetail,
  entity: CyclingActivityEntity
): CyclingActivityEntity => {
  entity.id = String(activity.id);
  entity.name = activity.name;
  entity.distanceMeters = activity.distance;
  entity.movingTimeSeconds = activity.moving_time;
  entity.startDate = new Date(activity.start_date);
  return entity;
};

/**
 * 初期取り込み(バックフィル)でDBにIDだけ先に挿入しておくためのプレースホルダーEntityを作る。
 * 詳細取得(GET /activities/{id})が完了するまでは位置情報を持たせない方針のため、
 * summary_polylineが取得できていてもpathには反映しない。
 * @param activity 変換元の一覧APIレスポンス
 * @returns 位置情報を持たないプレースホルダーEntity
 */
export const toPlaceholderCyclingActivityEntity = (activity: StravaActivity): CyclingActivityEntity => {
  const entity = mapBaseFields(activity, new CyclingActivityEntity());
  entity.path = null;
  entity.detailFetchedAt = null;
  return entity;
};

/**
 * 詳細API(GET /activities/{id})のレスポンスから高解像度のEntityを作る。
 * 高解像度のpolylineを優先し、GPSルートの無い手動記録等でpolylineが空の場合はsummary_polylineにフォールバックする。
 * @param detail 変換元の詳細APIレスポンス
 * @returns 位置情報を含むEntity
 */
export const toCyclingActivityEntityFromDetail = (detail: StravaActivityDetail): CyclingActivityEntity => {
  const entity = mapBaseFields(detail, new CyclingActivityEntity());
  const encodedPolyline = detail.map.polyline !== EMPTY_POLYLINE ? detail.map.polyline : detail.map.summary_polyline;
  const path = decodePolylineToPath(encodedPolyline);
  entity.path = path === null ? null : { type: 'LineString', coordinates: path };
  entity.detailFetchedAt = new Date();
  return entity;
};
