import type { FeatureCollection } from 'geojson';
import type maplibregl from 'maplibre-gl';
import { fetchMunicipalityBoundaries } from '../api/municipalitiesApi';
import {
  ADMIN_BOUNDARY_FOCUSED_LINE_COLOR,
  ADMIN_BOUNDARY_FOCUSED_LINE_DASHARRAY,
  ADMIN_BOUNDARY_FOCUSED_LINE_LAYER_ID,
  ADMIN_BOUNDARY_FOCUSED_LINE_WIDTH,
  ADMIN_BOUNDARY_FOCUSED_SOURCE_ID,
  ADMIN_BOUNDARY_HISTORICAL_FILL_COLOR,
  ADMIN_BOUNDARY_HISTORICAL_FILL_LAYER_ID,
  ADMIN_BOUNDARY_HISTORICAL_FILL_OPACITY,
  ADMIN_BOUNDARY_HISTORICAL_LABEL_HALO_COLOR,
  ADMIN_BOUNDARY_HISTORICAL_LABEL_HALO_WIDTH,
  ADMIN_BOUNDARY_HISTORICAL_LABEL_LAYER_ID,
  ADMIN_BOUNDARY_HISTORICAL_LABEL_TEXT_COLOR,
  ADMIN_BOUNDARY_HISTORICAL_LINE_LAYER_ID,
  ADMIN_BOUNDARY_HISTORICAL_SOURCE_ID,
  ADMIN_BOUNDARY_HITTEST_FILL_LAYER_ID,
  ADMIN_BOUNDARY_HITTEST_SOURCE_ID,
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
import { MUNICIPALITY_ERA_CURRENT, type MunicipalityEra } from '../types/municipalityEra';

const EMPTY_FEATURE_COLLECTION: FeatureCollection = { type: 'FeatureCollection', features: [] };
const LABEL_TEXT_SIZE = 12;

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

/**
 * 過去の行政区画（era!=='current'）を描画するための、空のGeoJSONソースと塗り・線・ラベルの3レイヤーを地図に追加する。
 * 実際のデータはapplyAdminBoundaryHistoricalDataがsetDataで反映する。市町村境界(admin-boundary-municipality)と
 * 同じ理由（低ズームでの過密表示・不要な計算を避けるため）で同じminzoomを設定する
 * @param map 追加先のMapLibre地図インスタンス
 */
export const addAdminBoundaryHistoricalLayer = (map: maplibregl.Map) => {
  map.addSource(ADMIN_BOUNDARY_HISTORICAL_SOURCE_ID, { type: 'geojson', data: EMPTY_FEATURE_COLLECTION });
  map.addLayer({
    id: ADMIN_BOUNDARY_HISTORICAL_FILL_LAYER_ID,
    type: 'fill',
    source: ADMIN_BOUNDARY_HISTORICAL_SOURCE_ID,
    minzoom: ADMIN_BOUNDARY_MUNICIPALITY_MIN_ZOOM,
    paint: {
      'fill-color': ADMIN_BOUNDARY_HISTORICAL_FILL_COLOR,
      'fill-opacity': ADMIN_BOUNDARY_HISTORICAL_FILL_OPACITY
    }
  });
  map.addLayer({
    id: ADMIN_BOUNDARY_HISTORICAL_LINE_LAYER_ID,
    type: 'line',
    source: ADMIN_BOUNDARY_HISTORICAL_SOURCE_ID,
    minzoom: ADMIN_BOUNDARY_MUNICIPALITY_MIN_ZOOM,
    paint: {
      'line-color': ADMIN_BOUNDARY_MUNICIPALITY_LINE_COLOR,
      'line-dasharray': ADMIN_BOUNDARY_MUNICIPALITY_LINE_DASHARRAY
    }
  });
  map.addLayer({
    id: ADMIN_BOUNDARY_HISTORICAL_LABEL_LAYER_ID,
    type: 'symbol',
    source: ADMIN_BOUNDARY_HISTORICAL_SOURCE_ID,
    minzoom: ADMIN_BOUNDARY_MUNICIPALITY_MIN_ZOOM,
    layout: { 'text-field': ['get', 'municipalityName'], 'text-size': LABEL_TEXT_SIZE },
    paint: {
      'text-color': ADMIN_BOUNDARY_HISTORICAL_LABEL_TEXT_COLOR,
      'text-halo-color': ADMIN_BOUNDARY_HISTORICAL_LABEL_HALO_COLOR,
      'text-halo-width': ADMIN_BOUNDARY_HISTORICAL_LABEL_HALO_WIDTH
    }
  });
};

/**
 * 行政区画クリック・通過自治体リストクリックによる範囲フォーカス機能に使う、空のGeoJSONソースと2レイヤーを
 * 地図に追加する。hit-testレイヤーは完全に透明なfillレイヤーとして追加し、クリック検出専用に使う。
 * 実際のデータはapplyAdminBoundaryData（hit-test用）・applyFocusedMunicipalityLayer（フォーカス表示用）が
 * setDataで反映する（Issue #76）
 * @param map 追加先のMapLibre地図インスタンス
 */
export const addAdminBoundaryFocusLayer = (map: maplibregl.Map) => {
  map.addSource(ADMIN_BOUNDARY_HITTEST_SOURCE_ID, { type: 'geojson', data: EMPTY_FEATURE_COLLECTION });
  map.addLayer({
    id: ADMIN_BOUNDARY_HITTEST_FILL_LAYER_ID,
    type: 'fill',
    source: ADMIN_BOUNDARY_HITTEST_SOURCE_ID,
    minzoom: ADMIN_BOUNDARY_MUNICIPALITY_MIN_ZOOM,
    paint: { 'fill-opacity': 0 }
  });

  map.addSource(ADMIN_BOUNDARY_FOCUSED_SOURCE_ID, { type: 'geojson', data: EMPTY_FEATURE_COLLECTION });
  map.addLayer({
    id: ADMIN_BOUNDARY_FOCUSED_LINE_LAYER_ID,
    type: 'line',
    source: ADMIN_BOUNDARY_FOCUSED_SOURCE_ID,
    minzoom: ADMIN_BOUNDARY_MUNICIPALITY_MIN_ZOOM,
    paint: {
      'line-color': ADMIN_BOUNDARY_FOCUSED_LINE_COLOR,
      'line-width': ADMIN_BOUNDARY_FOCUSED_LINE_WIDTH,
      'line-dasharray': ADMIN_BOUNDARY_FOCUSED_LINE_DASHARRAY
    }
  });
};

/**
 * 選択中の年代の行政区画境界データを取得する。取得結果はeraごとにcacheへ保存し、同じ年代へ再度
 * 切り替えた際の再取得を避ける。`applyAdminBoundaryData`（表示・hit-testソースへの反映を伴う）と
 * `applyFocusedMunicipalityLayer`（フォーカス対象の検索）の両方から使う共通処理として切り出している
 * （Issue #80フォローアップ。フォーカス対象の検索のためだけに表示・hit-testソースへ毎回setDataし直すと、
 * 全国分のジオメトリの再インデックス化が発生し重くなるため、setDataを伴わない取得専用の経路を用意した）
 * @param era 取得対象の年代識別子
 * @param cache 年代ごとに取得済みのGeoJSONを保持するキャッシュ（呼び出し元が状態を持ち、この関数はそれを読み書きする）
 * @returns 該当年代の境界データ（GeoJSON FeatureCollection）
 */
export const getOrFetchMunicipalityBoundaries = async (
  era: MunicipalityEra,
  cache: Map<MunicipalityEra, FeatureCollection>
): Promise<FeatureCollection> => {
  const cached = cache.get(era);
  if (cached) {
    return cached;
  }
  const featureCollection = await fetchMunicipalityBoundaries(era);
  cache.set(era, featureCollection);
  return featureCollection;
};

/**
 * 選択中の年代の行政区画境界データを取得し、hit-test用ソースへ反映する。currentの場合、見た目は現行の
 * ベクトルタイル（boundary_3・admin-boundary-municipality）で描画済みのため過去年代用の表示ソースへの反映は
 * 行わないが、クリックによる範囲フォーカス機能（Issue #76）はhit-testソースを介して年代によらず動作させるため、
 * hit-test用ソースへの反映はcurrentでも行う
 * @param map 反映先のMapLibre地図インスタンス
 * @param era 選択中の年代識別子
 * @param cache 年代ごとに取得済みのGeoJSONを保持するキャッシュ（呼び出し元が状態を持ち、この関数はそれを読み書きする）
 */
export const applyAdminBoundaryData = async (
  map: maplibregl.Map,
  era: MunicipalityEra,
  cache: Map<MunicipalityEra, FeatureCollection>
): Promise<void> => {
  const featureCollection = await getOrFetchMunicipalityBoundaries(era, cache);

  const hitTestSource = map.getSource<maplibregl.GeoJSONSource>(ADMIN_BOUNDARY_HITTEST_SOURCE_ID);
  hitTestSource?.setData(featureCollection);

  if (era === MUNICIPALITY_ERA_CURRENT) {
    return;
  }

  const source = map.getSource<maplibregl.GeoJSONSource>(ADMIN_BOUNDARY_HISTORICAL_SOURCE_ID);
  source?.setData(featureCollection);
};
