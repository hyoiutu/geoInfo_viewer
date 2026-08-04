import { Box } from '@chakra-ui/react';
import { useRef } from 'react';
import type { CyclingActivity, PassedMunicipality, Photo } from '../api/activitiesApi';
import { useAdminBoundaryClickInteraction } from '../hooks/useAdminBoundaryClickInteraction';
import { useAdminBoundaryData } from '../hooks/useAdminBoundaryData';
import { useBicycleLogClickInteraction } from '../hooks/useBicycleLogClickInteraction';
import { useBicycleLogDataSync } from '../hooks/useBicycleLogDataSync';
import { useFocusedActivityHover } from '../hooks/useFocusedActivityHover';
import { useLayerVisibilitySync } from '../hooks/useLayerVisibilitySync';
import { useMapInstance } from '../hooks/useMapInstance';
import { usePhotoBalloons } from '../hooks/usePhotoBalloons';
import { useSelectionLayerSync } from '../hooks/useSelectionLayerSync';
import { useStartGoalMarkers } from '../hooks/useStartGoalMarkers';
import type { LayerVisibility } from '../types/layer';
import type { MunicipalityEra } from '../types/municipalityEra';

/** MapViewのprops */
type MapViewProps = {
  /** レイヤーIDごとの表示/非表示状態 */
  layerVisibility: LayerVisibility;
  /** 選択中のアクティビティ一覧 */
  selectedActivities: CyclingActivity[];
  /** フォーカス中のアクティビティ。未フォーカスの場合はnull */
  focusedActivity: CyclingActivity | null;
  /** 地図クリックでアクティビティが検出されたときに呼ばれるコールバック */
  onSelectActivities: (ids: string[]) => void;
  /** 地図に描画するアクティビティ一覧（フィルタ適用済み） */
  filteredActivities: CyclingActivity[];
  /** 表示する行政区画の年代 */
  adminBoundaryEra: MunicipalityEra;
  /** フォーカス中の自治体（地図クリック・通過自治体リストのクリックいずれか）。未フォーカスの場合はnull */
  focusedMunicipality: PassedMunicipality | null;
  /** 行政区画クリックで自治体が検出されたときに呼ばれるコールバック */
  onFocusMunicipality: (municipality: PassedMunicipality) => void;
  /**
   * adminBoundaryEraの変化に伴う境界データの取得・地図への反映が完了した時点（成功・失敗問わず）で呼ばれる
   * コールバック。レイヤーダイアログのローディング状態解除に使う（Issue #65）
   */
  onAdminBoundaryDataApplied?: () => void;
  /** フォーカス中のアクティビティの写真一覧（地図上の吹き出し表示用、Issue #107） */
  photos: Photo[];
  /** 写真吹き出し（単一写真のみ）がクリックされたときに、対象の写真IDを渡して呼ばれるコールバック（拡大プレビュー表示用、Issue #108） */
  onPhotoClick: (photoId: number) => void;
};

/**
 * MapLibreの地図本体を表示するコンポーネント。「地図インスタンスの生成・破棄」「渡された表示状態
 * （レイヤー可視性・フィルタ済みアクティビティ・選択/フォーカス）を地図に反映する」「クリックによる選択検出」に
 * 責務を絞る。自転車ログの新規アクティビティ取得（Strava同期）は`useCyclingActivities`（呼び出し元が使用）が担う（Issue #58）。
 * クリック検出・選択レイヤー反映・スタートゴールマーカー・レイヤー可視性反映といった地図操作の純粋関数自体は
 * `mapLayerInteraction.ts`へ切り出しており（PR #71レビュー対応）、Reactのライフサイクルとの結線（useEffect）も
 * 関心事ごとに個別のカスタムフック（`frontend/src/hooks/use*`）へ切り出している。このコンポーネント自体は
 * `containerRef`とフックの呼び出し・結線のみを行う薄い構成にしている（Issue #127）
 */
export const MapView = ({
  layerVisibility,
  selectedActivities,
  focusedActivity,
  onSelectActivities,
  filteredActivities,
  adminBoundaryEra,
  focusedMunicipality,
  onFocusMunicipality,
  onAdminBoundaryDataApplied,
  photos,
  onPhotoClick
}: MapViewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { mapRef, isStyleLoaded, categorizedLayerIdsRef } = useMapInstance(containerRef);

  useBicycleLogClickInteraction(mapRef, isStyleLoaded, onSelectActivities, focusedActivity);
  useAdminBoundaryClickInteraction(mapRef, isStyleLoaded, onFocusMunicipality, focusedActivity);
  useFocusedActivityHover(mapRef, isStyleLoaded, focusedActivity);
  useBicycleLogDataSync(mapRef, filteredActivities, isStyleLoaded);
  useSelectionLayerSync(mapRef, selectedActivities, focusedActivity, isStyleLoaded);
  useStartGoalMarkers(mapRef, focusedActivity, isStyleLoaded);
  usePhotoBalloons(mapRef, photos, isStyleLoaded, onPhotoClick);
  useLayerVisibilitySync(mapRef, categorizedLayerIdsRef, layerVisibility, adminBoundaryEra, isStyleLoaded);
  useAdminBoundaryData(mapRef, adminBoundaryEra, focusedMunicipality, isStyleLoaded, onAdminBoundaryDataApplied);

  return <Box ref={containerRef} flex="1" minWidth="0" height="100%" data-testid="map-container" />;
};
