import maplibregl from 'maplibre-gl';
import type { Root } from 'react-dom/client';
import type { CyclingActivity } from '../api/activitiesApi';
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
