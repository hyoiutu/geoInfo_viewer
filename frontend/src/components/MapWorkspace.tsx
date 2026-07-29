import { Box, Flex } from '@chakra-ui/react';
import { useMemo, useState } from 'react';
import type { PassedMunicipality } from '../api/activitiesApi';
import { createDefaultVisibility } from '../constants/layerDefinitions';
import { useActivitySelection } from '../hooks/useActivitySelection';
import { useBackfillProgressFooter } from '../hooks/useBackfillProgressFooter';
import { useBackfillStatus } from '../hooks/useBackfillStatus';
import { useCyclingActivities } from '../hooks/useCyclingActivities';
import { type ActivityFilter, DEFAULT_ACTIVITY_FILTER } from '../types/activityFilter';
import type { LayerVisibility } from '../types/layer';
import { MUNICIPALITY_ERA_CURRENT, type MunicipalityEra } from '../types/municipalityEra';
import { filterActivities } from '../utils/filterActivities';
import { ActivityDetailSidebar } from './ActivityDetailSidebar';
import { BackfillProgressFooter } from './BackfillProgressFooter';
import { ErrorDialog } from './ErrorDialog';
import { MapControls } from './MapControls';
import { MapView } from './MapView';

/**
 * レイヤーダイアログの実行によって発生した非同期処理（行政区画データ取得・自転車ログ同期）のうち、
 * まだ完了していないものを表す。いずれもfalseになった時点でレイヤーダイアログを閉じてよい（Issue #65）
 */
type PendingLayerApply = {
  /** 行政区画データの取得・地図への反映がまだ完了していないか */
  waitingForAdminBoundary: boolean;
  /** 自転車ログの同期・参照取得がまだ完了していないか */
  waitingForCyclingLog: boolean;
};

/**
 * 地図・Map Controls・各種ダイアログを組み合わせたアプリのメイン画面。
 * 各種状態のうち「確定済みの結果」（レイヤー表示状態・フィルタ条件・アクティビティの選択状態）のみをここで一元管理し、
 * 各コンポーネントへpropsとして渡す。ダイアログの開閉・入力中(draft)の内容はMapControls・各Dialogコンポーネント自身が
 * 保持する（Issue #53）。自転車ログの新規アクティビティ取得（Strava同期）は`useCyclingActivities`が担い、
 * フィルタ計算もここで1回だけ行った上でMapViewへ渡す（Issue #58）。エラー状態はグローバルステート（errorsAtom）で
 * 管理するため、ここでは保持しない
 */
export const MapWorkspace = () => {
  const [visibility, setVisibility] = useState<LayerVisibility>(createDefaultVisibility);
  const [era, setEra] = useState<MunicipalityEra>(MUNICIPALITY_ERA_CURRENT);
  const [filter, setFilter] = useState<ActivityFilter>(DEFAULT_ACTIVITY_FILTER);
  const [focusedMunicipality, setFocusedMunicipality] = useState<PassedMunicipality | null>(null);
  // レイヤーダイアログの実行に伴う非同期処理の進行状況（Issue #65）。nullは「実行直後の非同期待ちが無い」を表す
  const [pendingLayerApply, setPendingLayerApply] = useState<PendingLayerApply | null>(null);

  const { backfillStatus, start: startBackfill, startForceRefetch } = useBackfillStatus();
  const {
    isVisible: isBackfillFooterVisible,
    show: showBackfillFooter,
    dismiss: dismissBackfillFooter
  } = useBackfillProgressFooter(backfillStatus);
  const handleCyclingLogSyncComplete = () => {
    setPendingLayerApply((current) => (current ? { ...current, waitingForCyclingLog: false } : current));
  };
  const { activities } = useCyclingActivities(visibility['bicycle-log'], handleCyclingLogSyncComplete);
  const { selectedActivities, focusedActivity, selectActivities, focusActivity, clearFocus, clearSelection } =
    useActivitySelection(activities, filter);

  const filteredActivities = useMemo(() => filterActivities(activities, filter), [activities, filter]);

  const isApplyingLayerSettings =
    pendingLayerApply !== null && (pendingLayerApply.waitingForAdminBoundary || pendingLayerApply.waitingForCyclingLog);

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
    setPendingLayerApply((current) => (current ? { ...current, waitingForAdminBoundary: false } : current));
  };

  const handleApplyLayerSettings = (nextVisibility: LayerVisibility, nextEra: MunicipalityEra) => {
    // 行政区画データ取得(MapViewのuseEffect)・自転車ログ同期(useCyclingActivities)は
    // いずれも変化を検知して反応するため、ここで「今回変化するかどうか」を先に判定しておく必要がある。
    // 完了通知(onAdminBoundaryDataApplied/onSyncComplete)を待つ対象を、実行直後の同じレンダーで
    // 確定させることで、非同期処理の開始前に誤って「待つものが無い」と判定してしまう競合を避ける（Issue #65）
    const willChangeEra = nextEra !== era;
    const willSyncCyclingLog = nextVisibility['bicycle-log'] && !visibility['bicycle-log'];
    setVisibility(nextVisibility);
    setEra(nextEra);
    setFocusedMunicipality(null);
    if (willChangeEra || willSyncCyclingLog) {
      setPendingLayerApply({ waitingForAdminBoundary: willChangeEra, waitingForCyclingLog: willSyncCyclingLog });
    }
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
          />
          <MapControls
            appliedVisibility={visibility}
            appliedEra={era}
            onApplyLayerSettings={handleApplyLayerSettings}
            isApplyingLayerSettings={isApplyingLayerSettings}
            appliedFilter={filter}
            onApplyFilter={setFilter}
            activities={activities}
            isBackfillRunning={backfillStatus?.isRunning ?? false}
            onStartBackfill={() => {
              showBackfillFooter();
              void startBackfill();
            }}
            onStartForceRefetch={() => {
              showBackfillFooter();
              void startForceRefetch();
            }}
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
        adminBoundaryEra={era}
        onMunicipalityFocus={setFocusedMunicipality}
      />
      <ErrorDialog />
    </Flex>
  );
};
