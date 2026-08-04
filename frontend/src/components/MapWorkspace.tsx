import { Box, Flex } from '@chakra-ui/react';
import { useAtomValue, useSetAtom } from 'jotai';
import { useMemo, useState } from 'react';
import type { PassedMunicipality } from '../api/activitiesApi';
import {
  clearPendingLayerApplyFlagAtom,
  isApplyingLayerSettingsAtom,
  startPendingLayerApplyAtom
} from '../atoms/isApplyingLayerSettingsAtom';
import { applyLayerSettingsAtom, layerVisibilityAtom, municipalityEraAtom } from '../atoms/layerSettingsAtom';
import { useActivitySelection } from '../hooks/useActivitySelection';
import { useBackfillProgressFooter } from '../hooks/useBackfillProgressFooter';
import { useBackfillStatus } from '../hooks/useBackfillStatus';
import { useCyclingActivities } from '../hooks/useCyclingActivities';
import { usePhotos } from '../hooks/usePhotos';
import { type ActivityFilter, DEFAULT_ACTIVITY_FILTER } from '../types/activityFilter';
import type { LayerVisibility } from '../types/layer';
import type { MunicipalityEra } from '../types/municipalityEra';
import { filterActivities } from '../utils/filterActivities';
import { resolveLayerSettingsChange } from '../utils/resolveLayerSettingsChange';
import { ActivityDetailSidebar } from './ActivityDetailSidebar';
import { BackfillProgressFooter } from './BackfillProgressFooter';
import { ErrorDialog } from './ErrorDialog';
import { MapControls } from './MapControls';
import { MapView } from './MapView';
import { PhotoPreviewModal } from './PhotoPreviewModal';

/**
 * 地図・Map Controls・各種ダイアログを組み合わせたアプリのメイン画面。
 * 各種状態のうち「確定済みの結果」（フィルタ条件・アクティビティの選択状態）のみをここで一元管理し、
 * 各コンポーネントへpropsとして渡す。ダイアログの開閉・入力中(draft)の内容はMapControls・各Dialogコンポーネント自身が
 * 保持する（Issue #53）。自転車ログの新規アクティビティ取得（Strava同期）は`useCyclingActivities`が担い、
 * フィルタ計算もここで1回だけ行った上でMapViewへ渡す（Issue #58）。エラー状態（errorsAtom）・レイヤーダイアログの
 * 非同期処理待機状態（isApplyingLayerSettingsAtom）・レイヤー表示状態/行政区画の年代（layerSettingsAtom）は
 * いずれもグローバルステートで管理するため、ここではローカルstateとして保持しない（Issue #125）
 */
export const MapWorkspace = () => {
  const isApplyingLayerSettings = useAtomValue(isApplyingLayerSettingsAtom);
  const startPendingLayerApply = useSetAtom(startPendingLayerApplyAtom);
  const clearPendingLayerApplyFlag = useSetAtom(clearPendingLayerApplyFlagAtom);
  const visibility = useAtomValue(layerVisibilityAtom);
  const era = useAtomValue(municipalityEraAtom);
  const applyLayerSettings = useSetAtom(applyLayerSettingsAtom);

  const [filter, setFilter] = useState<ActivityFilter>(DEFAULT_ACTIVITY_FILTER);
  const [focusedMunicipality, setFocusedMunicipality] = useState<PassedMunicipality | null>(null);
  // 拡大プレビュー中の写真の、photos内でのindex（Issue #108）。nullは非表示を表す
  const [previewPhotoIndex, setPreviewPhotoIndex] = useState<number | null>(null);

  const { backfillStatus, start: startBackfill, startForceRefetch } = useBackfillStatus();
  const {
    isVisible: isBackfillFooterVisible,
    show: showBackfillFooter,
    dismiss: dismissBackfillFooter
  } = useBackfillProgressFooter(backfillStatus);
  const { activities, syncAndLoadBicycleLog } = useCyclingActivities(() =>
    clearPendingLayerApplyFlag('waitingForCyclingLog')
  );
  const { selectedActivities, focusedActivity, selectActivities, focusActivity, clearFocus, clearSelection } =
    useActivitySelection(activities, filter);
  // アクティビティパネルの写真表示（Issue #105）・地図上の写真吹き出し表示（Issue #107）の両方が
  // 同じ写真一覧を必要とするため、ここで1回だけ取得して両方へpropsとして渡す
  const { photos, isLoading: isPhotosLoading } = usePhotos(focusedActivity?.id ?? null);

  const filteredActivities = useMemo(() => filterActivities(activities, filter), [activities, filter]);

  // フォーカス中のアクティビティ・行政区画の年代が変わると、通過自治体一覧の内容自体が変わり
  // 直前にフォーカスしていた自治体が無関係になるため、行政区画のフォーカスも解除する（Issue #76）
  const handleFocusActivity = (index: number) => {
    setFocusedMunicipality(null);
    focusActivity(index);
  };

  const handleBackFromDetail = () => {
    setFocusedMunicipality(null);
    clearFocus();
  };

  const handleAdminBoundaryDataApplied = () => {
    clearPendingLayerApplyFlag('waitingForAdminBoundary');
  };

  // アクティビティパネル・地図上の吹き出しいずれのサムネイルクリックも、同じphotos配列内でのindexを
  // 特定して拡大プレビューを開く（見た目・挙動を共通化する、Issue #108のユーザー回答）
  const handlePhotoClick = (photoId: number) => {
    const index = photos.findIndex((photo) => photo.id === photoId);
    if (index !== -1) {
      setPreviewPhotoIndex(index);
    }
  };

  const handleApplyLayerSettings = (nextVisibility: LayerVisibility, nextEra: MunicipalityEra) => {
    // 行政区画データ取得(MapViewのuseEffect)・自転車ログ同期(syncAndLoadBicycleLog)は
    // いずれも「今回変化するかどうか」の判定結果に基づき動くため、ここで先に同期的に判定しておく必要がある。
    // 完了通知(onAdminBoundaryDataApplied/onSyncComplete)を待つ対象を、実行直後の同じレンダーで
    // 確定させることで、非同期処理の開始前に誤って「待つものが無い」と判定してしまう競合を避ける（Issue #65）
    const { willChangeEra, willSyncCyclingLog } = resolveLayerSettingsChange(visibility, era, nextVisibility, nextEra);
    applyLayerSettings({ visibility: nextVisibility, era: nextEra });
    setFocusedMunicipality(null);
    if (willChangeEra || willSyncCyclingLog) {
      startPendingLayerApply({ waitingForAdminBoundary: willChangeEra, waitingForCyclingLog: willSyncCyclingLog });
    }
    // 自転車ログレイヤーがOFF→ONに変化する場合のみ、Strava新規アクティビティ取得・参照取得を行う
    // （以前はuseCyclingActivities内部のuseEffectが独自に変化検知していたが、上記判定と重複していたため
    // ここでの判定結果をそのまま使う形に一本化した、Issue #125）
    if (willSyncCyclingLog) {
      void syncAndLoadBicycleLog();
    }
  };

  // 開始操作と同期的にshowBackfillFooterを呼び、isRunning:trueの観測を待たずフッターを表示する（Issue #86）
  const handleStartBackfill = () => {
    showBackfillFooter();
    void startBackfill();
  };

  const handleStartForceRefetch = () => {
    showBackfillFooter();
    void startForceRefetch();
  };

  return (
    <Flex height="100vh" cursor={isApplyingLayerSettings ? 'wait' : undefined} data-testid="map-workspace-root">
      <Flex direction="column" flex="1" minWidth="0">
        <Box position="relative" flex="1" minHeight="0">
          <MapView
            layerVisibility={visibility}
            selectedActivities={selectedActivities}
            focusedActivity={focusedActivity}
            onSelectActivities={selectActivities}
            filteredActivities={filteredActivities}
            adminBoundaryEra={era}
            focusedMunicipality={focusedMunicipality}
            onFocusMunicipality={setFocusedMunicipality}
            onAdminBoundaryDataApplied={handleAdminBoundaryDataApplied}
            photos={photos}
            onPhotoClick={handlePhotoClick}
          />
          <MapControls
            onApplyLayerSettings={handleApplyLayerSettings}
            appliedFilter={filter}
            onApplyFilter={setFilter}
            activities={activities}
            isBackfillRunning={backfillStatus?.isRunning ?? false}
            onStartBackfill={handleStartBackfill}
            onStartForceRefetch={handleStartForceRefetch}
          />
        </Box>
        <BackfillProgressFooter
          isVisible={isBackfillFooterVisible}
          backfillStatus={backfillStatus}
          onDismiss={dismissBackfillFooter}
        />
      </Flex>
      <ActivityDetailSidebar
        activities={selectedActivities}
        focusedActivity={focusedActivity}
        onFocus={handleFocusActivity}
        onBackFromDetail={handleBackFromDetail}
        onBackFromList={clearSelection}
        onMunicipalityFocus={setFocusedMunicipality}
        photos={photos}
        isPhotosLoading={isPhotosLoading}
        onPhotoClick={handlePhotoClick}
      />
      <PhotoPreviewModal
        photos={photos}
        selectedIndex={previewPhotoIndex}
        onClose={() => setPreviewPhotoIndex(null)}
        onNavigate={setPreviewPhotoIndex}
      />
      <ErrorDialog />
    </Flex>
  );
};
