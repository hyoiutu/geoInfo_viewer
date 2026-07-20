import type { FeatureCollection } from 'geojson';
import maplibregl from 'maplibre-gl';
import type { Root } from 'react-dom/client';
import type { CyclingActivity, PassedMunicipality } from '../api/activitiesApi';
import { ADMIN_BOUNDARY_FOCUSED_SOURCE_ID, ADMIN_BOUNDARY_HITTEST_FILL_LAYER_ID } from '../constants/adminBoundary';
import {
  BICYCLE_LOG_FOCUSED_LAYER_ID,
  BICYCLE_LOG_FOCUSED_SOURCE_ID,
  BICYCLE_LOG_LAYER_ID,
  BICYCLE_LOG_SELECTED_LAYER_ID,
  BICYCLE_LOG_SELECTED_SOURCE_ID
} from '../constants/bicycleLog';
import type { CategorizedLayerIds, LayerVisibility } from '../types/layer';
import type { MunicipalityEra } from '../types/municipalityEra';
import { cyclingActivityToGeoJson } from './cyclingActivityToGeoJson';
import { findDistanceAlongPathAtPoint } from './findDistanceAlongPathAtPoint';
import { resolveStyleLayerIds, resolveUnusedAdminBoundaryLayerIds } from './mapLayerCategory';
import { createGoalMarkerElement, createStartMarkerElement } from './startGoalMarkerElement';
import { typedEntries } from './typedObject';

const VISIBLE_VALUE = 'visible';
const HIDDEN_VALUE = 'none';
// 自転車ログの線は太さ2〜4pxと細く正確なクリックが難しいため、クリック地点を中心とした
// 10px四方(片側5px)のバウンディングボックスでヒットテストする
const HIT_TEST_RADIUS_PX = 5;

/**
 * 自転車ログレイヤーのクリックを検出し、選択中アクティビティを置き換える。
 * 線が細く正確なクリックが難しいため、クリック地点を中心としたバウンディングボックスでヒットテストする。
 * フォーカス中はクリックによる選択変更を無効にする
 * @param map クリックを監視するMapLibre地図インスタンス
 * @param onSelectActivities 検出したアクティビティID一覧を渡すコールバック
 * @param isFocused 呼び出し時点でフォーカス中かどうかを返す関数
 */
export const registerBicycleLogClickHandler = (
  map: maplibregl.Map,
  onSelectActivities: (ids: string[]) => void,
  isFocused: () => boolean
) => {
  map.on('click', (event) => {
    if (isFocused()) {
      return;
    }

    const bbox: [maplibregl.PointLike, maplibregl.PointLike] = [
      [event.point.x - HIT_TEST_RADIUS_PX, event.point.y - HIT_TEST_RADIUS_PX],
      [event.point.x + HIT_TEST_RADIUS_PX, event.point.y + HIT_TEST_RADIUS_PX]
    ];
    const features = map.queryRenderedFeatures(bbox, {
      layers: [BICYCLE_LOG_LAYER_ID, BICYCLE_LOG_SELECTED_LAYER_ID, BICYCLE_LOG_FOCUSED_LAYER_ID]
    });
    // 同一クリックでも複数の描画フィーチャーが同一アクティビティIDを指しうるため重複排除する
    const ids = [...new Set(features.map((feature) => String(feature.properties?.id)))];
    if (ids.length > 0) {
      onSelectActivities(ids);
    }
  });
};

/**
 * フォーカス中のアクティビティの線上をマウスオーバーしたとき、始点からその地点までの軌跡に沿った距離を
 * コールバックへ渡す（Issue #77）。クリックと同様に線が細く正確なホバーが難しいため、カーソル位置を中心とした
 * バウンディングボックスでヒットテストする。フォーカス中のアクティビティが無い、線上でない、または軌跡
 * （GPSルート）を持たない場合はonHoverEndを呼ぶ
 * @param map マウス移動を監視するMapLibre地図インスタンス
 * @param getFocusedActivity 呼び出し時点でフォーカス中のアクティビティを返す関数。未フォーカスの場合はnull
 * @param onHover 検出した地点(経度緯度)と、始点からその地点までの軌跡に沿った距離(メートル)を渡すコールバック
 * @param onHoverEnd 線上から外れた（またはフォーカス無し・軌跡無し）ときに呼ばれるコールバック
 */
export const registerFocusedActivityHoverHandler = (
  map: maplibregl.Map,
  getFocusedActivity: () => CyclingActivity | null,
  onHover: (point: [number, number], distanceMeters: number) => void,
  onHoverEnd: () => void
) => {
  map.on('mousemove', (event) => {
    const focusedActivity = getFocusedActivity();
    if (!focusedActivity?.path) {
      onHoverEnd();
      return;
    }

    const bbox: [maplibregl.PointLike, maplibregl.PointLike] = [
      [event.point.x - HIT_TEST_RADIUS_PX, event.point.y - HIT_TEST_RADIUS_PX],
      [event.point.x + HIT_TEST_RADIUS_PX, event.point.y + HIT_TEST_RADIUS_PX]
    ];
    const features = map.queryRenderedFeatures(bbox, { layers: [BICYCLE_LOG_FOCUSED_LAYER_ID] });
    if (features.length === 0) {
      onHoverEnd();
      return;
    }

    const point: [number, number] = [event.lngLat.lng, event.lngLat.lat];
    const distanceMeters = findDistanceAlongPathAtPoint(focusedActivity.path, point);
    if (distanceMeters === null) {
      onHoverEnd();
      return;
    }
    onHover(point, distanceMeters);
  });
};

/**
 * 選択・フォーカス状態を、自転車ログの選択用・フォーカス用レイヤーのGeoJSONデータへ反映する。
 * selectedActivitiesの並び順（通し番号の昇順）をそのままfeatures配列の並びとして使う。MapLibreは
 * 単一ソース内で後の要素ほど手前に描画するため、これにより「通し番号が大きいものほど手前」というdraw順が実現される
 * @param map 反映先のMapLibre地図インスタンス
 * @param selectedActivities 選択中のアクティビティ一覧（通し番号の昇順）
 * @param focusedActivity フォーカス中のアクティビティ。未フォーカスの場合はnull
 */
export const applySelectionLayers = (
  map: maplibregl.Map,
  selectedActivities: CyclingActivity[],
  focusedActivity: CyclingActivity | null
) => {
  const selectedSource = map.getSource<maplibregl.GeoJSONSource>(BICYCLE_LOG_SELECTED_SOURCE_ID);
  const focusedSource = map.getSource<maplibregl.GeoJSONSource>(BICYCLE_LOG_FOCUSED_SOURCE_ID);
  if (!selectedSource || !focusedSource) {
    return;
  }
  const selectedExcludingFocused = selectedActivities.filter((activity) => activity.id !== focusedActivity?.id);
  selectedSource.setData(cyclingActivityToGeoJson(selectedExcludingFocused));
  focusedSource.setData(cyclingActivityToGeoJson(focusedActivity ? [focusedActivity] : []));
};

/** スタート・ゴールマーカー1件分の、地図上のMarkerとそのアイコンを描画しているReact rootの組 */
export type StartGoalMarkerEntry = {
  /** 地図上のMarkerインスタンス */
  marker: maplibregl.Marker;
  /** マーカーのアイコンをレンダリングしているReact root */
  root: Root;
};

/**
 * フォーカス中のアクティビティの開始地点・終了地点に、スタート・ゴールを示すマーカーを表示する。
 * pathは位置飛び（測定不能区間）で区間分割された座標配列の配列のため、最初の区間の最初の点をスタート、
 * 最後の区間の最後の点をゴールとする。フォーカスが無い場合、または軌跡(path)を持たないアクティビティの場合は
 * マーカーを全て取り除く。開始地点と終了地点が同じ座標の場合（周回ルート等）に手前へ描画されるよう、
 * スタートのマーカーを後から追加する
 * @param map 反映先のMapLibre地図インスタンス
 * @param markersRef 直前に表示していたマーカー・React rootの組を保持するref（今回分の反映前に取り除くために使う）
 * @param focusedActivity フォーカス中のアクティビティ。未フォーカスの場合はnull
 */
export const applyStartGoalMarkers = (
  map: maplibregl.Map,
  markersRef: { current: StartGoalMarkerEntry[] },
  focusedActivity: CyclingActivity | null
) => {
  for (const { marker, root } of markersRef.current) {
    marker.remove();
    root.unmount();
  }
  markersRef.current = [];

  const path = focusedActivity?.path;
  const firstSegment = path?.[0];
  const lastSegment = path?.[path.length - 1];
  if (!firstSegment || !lastSegment || firstSegment.length === 0 || lastSegment.length === 0) {
    return;
  }

  const startPoint = firstSegment[0];
  const goalPoint = lastSegment[lastSegment.length - 1];
  const goal = createGoalMarkerElement();
  const goalMarker = new maplibregl.Marker({ element: goal.element }).setLngLat(goalPoint).addTo(map);
  const start = createStartMarkerElement();
  const startMarker = new maplibregl.Marker({ element: start.element }).setLngLat(startPoint).addTo(map);

  markersRef.current = [
    { marker: goalMarker, root: goal.root },
    { marker: startMarker, root: start.root }
  ];
};

/**
 * 現在の表示/非表示状態を、対応するMapLibreスタイルレイヤーへ反映する
 * @param map 反映先のMapLibre地図インスタンス
 * @param categorizedLayerIds カテゴリごとに分類されたスタイルレイヤーIDの一覧
 * @param layerVisibility レイヤーIDごとの表示/非表示状態
 * @param adminBoundaryEra 選択中の行政区画の年代識別子
 */
export const applyLayerVisibility = (
  map: maplibregl.Map,
  categorizedLayerIds: CategorizedLayerIds,
  layerVisibility: LayerVisibility,
  adminBoundaryEra: MunicipalityEra
) => {
  const entries = typedEntries(layerVisibility);

  for (const [layerId, isVisible] of entries) {
    const visibility = isVisible ? VISIBLE_VALUE : HIDDEN_VALUE;
    const styleLayerIds = resolveStyleLayerIds(layerId, categorizedLayerIds, adminBoundaryEra);
    for (const styleLayerId of styleLayerIds) {
      map.setLayoutProperty(styleLayerId, 'visibility', visibility);
    }
  }

  // admin-boundaryは選択中の年代（current/過去）によって現行・過去年代いずれかのレイヤー群のみを使うため、
  // 選択されていない方の年代のレイヤー群は行政区画レイヤーのON/OFFに関わらず常に非表示にする（Issue #67）
  const unusedAdminBoundaryLayerIds = resolveUnusedAdminBoundaryLayerIds(categorizedLayerIds, adminBoundaryEra);
  for (const styleLayerId of unusedAdminBoundaryLayerIds) {
    map.setLayoutProperty(styleLayerId, 'visibility', HIDDEN_VALUE);
  }
};

/**
 * 行政区画hit-testレイヤーのクリックを検出し、クリック地点を含む自治体をコールバックへ渡す（Issue #76）
 * @param map クリックを監視するMapLibre地図インスタンス
 * @param onFocusMunicipality 検出した自治体を渡すコールバック
 */
export const registerAdminBoundaryClickHandler = (
  map: maplibregl.Map,
  onFocusMunicipality: (municipality: PassedMunicipality) => void
) => {
  map.on('click', ADMIN_BOUNDARY_HITTEST_FILL_LAYER_ID, (event) => {
    const properties = event.features?.[0]?.properties;
    const prefectureName = properties?.prefectureName;
    const municipalityName = properties?.municipalityName;
    if (typeof prefectureName !== 'string' || typeof municipalityName !== 'string') {
      return;
    }
    onFocusMunicipality({ prefectureName, municipalityName });
  });
};

/**
 * フォーカス中の自治体（地図クリック・通過自治体リストのクリックいずれかで選ばれたもの）に対応するfeatureを
 * 行政区画データのFeatureCollectionから都道府県名・市区町村名で検索し、フォーカス用オーバーレイのデータへ
 * 反映する。未フォーカス、または該当するfeatureが見つからない場合は空にする（Issue #76）
 * @param map 反映先のMapLibre地図インスタンス
 * @param featureCollection 検索対象の行政区画データ（都道府県名・市区町村名のプロパティを持つ）
 * @param focusedMunicipality フォーカス対象。未フォーカスの場合はnull
 */
export const applyFocusedMunicipalityLayer = (
  map: maplibregl.Map,
  featureCollection: FeatureCollection,
  focusedMunicipality: PassedMunicipality | null
) => {
  const source = map.getSource<maplibregl.GeoJSONSource>(ADMIN_BOUNDARY_FOCUSED_SOURCE_ID);
  if (!source) {
    return;
  }

  const feature = focusedMunicipality
    ? featureCollection.features.find(
        (candidate) =>
          candidate.properties?.prefectureName === focusedMunicipality.prefectureName &&
          candidate.properties?.municipalityName === focusedMunicipality.municipalityName
      )
    : undefined;
  source.setData({ type: 'FeatureCollection', features: feature ? [feature] : [] });
};
