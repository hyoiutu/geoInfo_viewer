import type { FeatureCollection } from 'geojson';
import type maplibregl from 'maplibre-gl';
import {
  ADMIN_BOUNDARY_MUNICIPALITY_FILTER,
  ADMIN_BOUNDARY_MUNICIPALITY_LAYER_ID,
  ADMIN_BOUNDARY_MUNICIPALITY_LINE_COLOR,
  ADMIN_BOUNDARY_MUNICIPALITY_LINE_DASHARRAY,
  ADMIN_BOUNDARY_MUNICIPALITY_MIN_ZOOM,
  ADMIN_BOUNDARY_MUNICIPALITY_SOURCE_ID,
  ADMIN_BOUNDARY_MUNICIPALITY_SOURCE_LAYER
} from '../constants/adminBoundary';
import {
  AERIAL_PHOTO_ATTRIBUTION,
  AERIAL_PHOTO_LAYER_ID,
  AERIAL_PHOTO_MAX_ZOOM,
  AERIAL_PHOTO_SOURCE_ID,
  AERIAL_PHOTO_TILE_SIZE,
  AERIAL_PHOTO_TILE_URL
} from '../constants/aerialPhoto';
import {
  BICYCLE_LOG_FOCUSED_LAYER_ID,
  BICYCLE_LOG_FOCUSED_OUTLINE_COLOR,
  BICYCLE_LOG_FOCUSED_OUTLINE_LAYER_ID,
  BICYCLE_LOG_FOCUSED_OUTLINE_WIDTH,
  BICYCLE_LOG_FOCUSED_SOURCE_ID,
  BICYCLE_LOG_LAYER_ID,
  BICYCLE_LOG_LINE_COLOR_DEFAULT,
  BICYCLE_LOG_LINE_COLOR_FOCUSED,
  BICYCLE_LOG_LINE_COLOR_SELECTED,
  BICYCLE_LOG_LINE_WIDTH_DEFAULT,
  BICYCLE_LOG_LINE_WIDTH_FOCUSED,
  BICYCLE_LOG_LINE_WIDTH_SELECTED,
  BICYCLE_LOG_SELECTED_LAYER_ID,
  BICYCLE_LOG_SELECTED_SOURCE_ID,
  BICYCLE_LOG_SOURCE_ID
} from '../constants/bicycleLog';
import type { CategorizedLayerIds } from '../types/layer';

const EMPTY_FEATURE_COLLECTION: FeatureCollection = { type: 'FeatureCollection', features: [] };

/**
 * 航空写真のラスタータイルレイヤーを地図に追加する
 * @param map 追加先のMapLibre地図インスタンス
 * @param categorizedLayerIds カテゴリごとに分類されたスタイルレイヤーIDの一覧
 */
export const addAerialPhotoLayer = (map: maplibregl.Map, categorizedLayerIds: CategorizedLayerIds) => {
  map.addSource(AERIAL_PHOTO_SOURCE_ID, {
    type: 'raster',
    tiles: [AERIAL_PHOTO_TILE_URL],
    tileSize: AERIAL_PHOTO_TILE_SIZE,
    attribution: AERIAL_PHOTO_ATTRIBUTION,
    maxzoom: AERIAL_PHOTO_MAX_ZOOM
  });

  const beforeId = categorizedLayerIds['osm-road'][0];
  map.addLayer({ id: AERIAL_PHOTO_LAYER_ID, type: 'raster', source: AERIAL_PHOTO_SOURCE_ID }, beforeId);
};

/**
 * 市町村行政区画の境界線レイヤーを地図に追加する。都道府県境界(boundary_3)は既存のOSMベーススタイルに
 * 含まれるため追加不要で、ここでは含まれていない市町村境界(admin_level 7〜8)のみを追加する。
 * 都道府県境界と同じ見た目にするため、そのすぐ手前(=下)に追加する
 * @param map 追加先のMapLibre地図インスタンス
 */
export const addAdminBoundaryLayer = (map: maplibregl.Map) => {
  map.addLayer(
    {
      id: ADMIN_BOUNDARY_MUNICIPALITY_LAYER_ID,
      type: 'line',
      source: ADMIN_BOUNDARY_MUNICIPALITY_SOURCE_ID,
      'source-layer': ADMIN_BOUNDARY_MUNICIPALITY_SOURCE_LAYER,
      filter: ADMIN_BOUNDARY_MUNICIPALITY_FILTER,
      minzoom: ADMIN_BOUNDARY_MUNICIPALITY_MIN_ZOOM,
      paint: {
        'line-color': ADMIN_BOUNDARY_MUNICIPALITY_LINE_COLOR,
        'line-dasharray': ADMIN_BOUNDARY_MUNICIPALITY_LINE_DASHARRAY
      }
    },
    'boundary_3'
  );
};

/**
 * 自転車ログ用の空のGeoJSONソース・ラインレイヤーを地図に追加する。
 * 通常状態(全アクティビティ)・選択状態・フォーカス状態をそれぞれ別のソース・レイヤーとして持つ。
 * 単一のline層には描画順を制御する仕組みが無いため、レイヤーを追加した順（=描画順、後から追加した方が手前）で
 * 「通常→選択→フォーカス」の手前関係を実現する。
 * フォーカス状態は他の線に埋もれず視認できるよう、フォーカス用ソースを参照する地図背景色のハロー(縁取り)レイヤーを
 * 色付き本体レイヤーより先に(=下に)追加する
 * @param map 追加先のMapLibre地図インスタンス
 */
export const addBicycleLogLayer = (map: maplibregl.Map) => {
  const addLineLayer = (sourceId: string, layerId: string, color: string, width: number) => {
    map.addLayer({
      id: layerId,
      type: 'line',
      source: sourceId,
      paint: { 'line-color': color, 'line-width': width }
    });
  };

  map.addSource(BICYCLE_LOG_SOURCE_ID, { type: 'geojson', data: EMPTY_FEATURE_COLLECTION });
  addLineLayer(
    BICYCLE_LOG_SOURCE_ID,
    BICYCLE_LOG_LAYER_ID,
    BICYCLE_LOG_LINE_COLOR_DEFAULT,
    BICYCLE_LOG_LINE_WIDTH_DEFAULT
  );

  map.addSource(BICYCLE_LOG_SELECTED_SOURCE_ID, { type: 'geojson', data: EMPTY_FEATURE_COLLECTION });
  addLineLayer(
    BICYCLE_LOG_SELECTED_SOURCE_ID,
    BICYCLE_LOG_SELECTED_LAYER_ID,
    BICYCLE_LOG_LINE_COLOR_SELECTED,
    BICYCLE_LOG_LINE_WIDTH_SELECTED
  );

  map.addSource(BICYCLE_LOG_FOCUSED_SOURCE_ID, { type: 'geojson', data: EMPTY_FEATURE_COLLECTION });
  addLineLayer(
    BICYCLE_LOG_FOCUSED_SOURCE_ID,
    BICYCLE_LOG_FOCUSED_OUTLINE_LAYER_ID,
    BICYCLE_LOG_FOCUSED_OUTLINE_COLOR,
    BICYCLE_LOG_FOCUSED_OUTLINE_WIDTH
  );
  addLineLayer(
    BICYCLE_LOG_FOCUSED_SOURCE_ID,
    BICYCLE_LOG_FOCUSED_LAYER_ID,
    BICYCLE_LOG_LINE_COLOR_FOCUSED,
    BICYCLE_LOG_LINE_WIDTH_FOCUSED
  );
};
