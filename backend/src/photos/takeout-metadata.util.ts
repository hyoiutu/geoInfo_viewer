import { gps, parse } from 'exifr';
import type { Point } from 'geojson';

const MILLISECONDS_PER_SECOND = 1000;
// Google Takeoutのメタデータは、位置情報が無い写真の場合latitude/longitudeが両方0.0になる
const EMPTY_COORDINATE = 0;

/** extractMetadataFromJson/extractMetadataFromExifの戻り値 */
export type PhotoMetadata = {
  /** 撮影日時 */
  takenAt: Date;
  /** 撮影位置。取得できない場合はnull */
  location: Point | null;
};

/** 緯度経度の組 */
type GeoCoordinate = {
  latitude: number;
  longitude: number;
};

/**
 * unknown値がlatitude/longitudeを持つオブジェクトかどうかを検証し、GeoCoordinateとして返す。
 * 両方が0.0の場合はGoogle Takeoutの「位置情報無し」を表す値のためnullを返す
 * @param value 検証対象の値（JSONのgeoData/geoDataExifフィールド相当）
 * @returns 検証済みのGeoCoordinate。無効または位置情報無しの場合はnull
 */
const readGeoCoordinate = (value: unknown): GeoCoordinate | null => {
  if (typeof value !== 'object' || value === null || !('latitude' in value) || !('longitude' in value)) {
    return null;
  }

  const { latitude, longitude } = value;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return null;
  }
  if (latitude === EMPTY_COORDINATE && longitude === EMPTY_COORDINATE) {
    return null;
  }

  return { latitude, longitude };
};

/**
 * Takeoutの写真JSONメタデータから撮影日時（photoTakenTime.timestamp）を読み取る
 * @param parsed JSON.parse済みの値
 * @returns epoch秒。読み取れない場合はnull
 */
const readTimestamp = (parsed: unknown): number | null => {
  if (typeof parsed !== 'object' || parsed === null || !('photoTakenTime' in parsed)) {
    return null;
  }

  const { photoTakenTime } = parsed;
  if (typeof photoTakenTime !== 'object' || photoTakenTime === null || !('timestamp' in photoTakenTime)) {
    return null;
  }

  const { timestamp } = photoTakenTime;
  if (typeof timestamp !== 'string') {
    return null;
  }

  const parsedTimestamp = Number(timestamp);
  return Number.isNaN(parsedTimestamp) ? null : parsedTimestamp;
};

/**
 * Takeoutの写真JSONメタデータから位置情報を読み取る。geoDataを優先し、無ければgeoDataExifを使う
 * @param parsed JSON.parse済みの値
 * @returns GeoJSONのPoint。読み取れない場合はnull
 */
const readLocation = (parsed: unknown): Point | null => {
  if (typeof parsed !== 'object' || parsed === null) {
    return null;
  }

  const geoData = 'geoData' in parsed ? readGeoCoordinate(parsed.geoData) : null;
  const coordinate = geoData ?? ('geoDataExif' in parsed ? readGeoCoordinate(parsed.geoDataExif) : null);
  if (coordinate === null) {
    return null;
  }

  return { type: 'Point', coordinates: [coordinate.longitude, coordinate.latitude] };
};

/**
 * Google TakeoutのJSONサイドカーファイルから、撮影日時・位置情報を抽出する
 * @param jsonBuffer JSONサイドカーファイルの中身
 * @returns 抽出したメタデータ。撮影日時が読み取れない、またはJSONとして不正な場合はnull
 */
export const extractMetadataFromJson = (jsonBuffer: Buffer): PhotoMetadata | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonBuffer.toString('utf-8'));
  } catch {
    return null;
  }

  const timestamp = readTimestamp(parsed);
  if (timestamp === null) {
    return null;
  }

  return {
    takenAt: new Date(timestamp * MILLISECONDS_PER_SECOND),
    location: readLocation(parsed)
  };
};

/**
 * 写真本体のEXIF情報から、撮影日時・位置情報を抽出する。JSONサイドカーが見つからない写真の
 * フォールバック用（Issue #23）
 * @param photoBuffer 写真本体のバイナリ
 * @returns 抽出したメタデータ。DateTimeOriginalが読み取れない場合、またはexifrが対応していない
 * ファイル形式（Takeoutに含まれる動画等）でパース自体が失敗した場合はnull
 */
export const extractMetadataFromExif = async (photoBuffer: Buffer): Promise<PhotoMetadata | null> => {
  let exif: unknown;
  try {
    exif = await parse(photoBuffer, { pick: ['DateTimeOriginal'] });
  } catch {
    return null;
  }

  const dateTimeOriginal =
    typeof exif === 'object' && exif !== null && 'DateTimeOriginal' in exif ? exif.DateTimeOriginal : undefined;
  if (!(dateTimeOriginal instanceof Date)) {
    return null;
  }

  return { takenAt: dateTimeOriginal, location: await readExifLocation(photoBuffer) };
};

/**
 * 写真本体のEXIF情報からGPS座標を読み取る。GPS情報が無い写真の場合exifrが例外を投げるため、
 * その場合はnullとして扱う
 * @param photoBuffer 写真本体のバイナリ
 * @returns GeoJSONのPoint。GPS情報が無い場合はnull
 */
const readExifLocation = async (photoBuffer: Buffer): Promise<Point | null> => {
  try {
    const { latitude, longitude } = await gps(photoBuffer);
    return { type: 'Point', coordinates: [longitude, latitude] };
  } catch {
    return null;
  }
};
