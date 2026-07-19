import { Box, Flex } from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import type { CyclingActivity } from '../api/activitiesApi';
import { LAYER_DEFINITIONS } from '../constants/layerDefinitions';
import { useActivityFilter } from '../hooks/useActivityFilter';
import { useActivitySelection } from '../hooks/useActivitySelection';
import { useBackfillProgressFooter } from '../hooks/useBackfillProgressFooter';
import { useBackfillStatus } from '../hooks/useBackfillStatus';
import { useLayerVisibility } from '../hooks/useLayerVisibility';
import { filterActivities } from '../utils/filterActivities';
import { ActivityDetailSidebar } from './ActivityDetailSidebar';
import { BackfillProgressFooter } from './BackfillProgressFooter';
import { ErrorDialog } from './ErrorDialog';
import { FilterDialog } from './FilterDialog';
import { LayerDialog } from './LayerDialog';
import { MapControls } from './MapControls';
import { MapView } from './MapView';
import { SettingsDialog } from './SettingsDialog';
import { StatisticsDialog } from './StatisticsDialog';

/**
 * 地図・Map Controls・各種ダイアログを組み合わせたアプリのメイン画面。
 * レイヤーの表示状態・アクティビティの選択状態をここで一元管理し、各コンポーネントへpropsとして渡す。
 * エラー状態はグローバルステート（errorsAtom）で管理するため、ここでは保持しない
 */
export const MapWorkspace = () => {
  const {
    appliedVisibility,
    draftVisibility,
    appliedEra,
    draftEra,
    setDraftEra,
    isDialogOpen: isLayerDialogOpen,
    openDialog: openLayerDialog,
    closeDialog: closeLayerDialog,
    toggleDraft: toggleLayerDraft,
    resetDraft: resetLayerDraft,
    applyDraft: applyLayerDraft
  } = useLayerVisibility();
  const { backfillStatus, start: startBackfill, startForceRefetch } = useBackfillStatus();
  const { isVisible: isBackfillFooterVisible, dismiss: dismissBackfillFooter } =
    useBackfillProgressFooter(backfillStatus);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [isStatisticsDialogOpen, setIsStatisticsDialogOpen] = useState(false);
  const [activities, setActivities] = useState<CyclingActivity[]>([]);
  const { selectedIds, focusedIndex, selectActivities, focusActivity, clearFocus, clearSelection, pruneToVisible } =
    useActivitySelection();
  const {
    appliedFilter,
    draftFilter,
    isDialogOpen: isFilterDialogOpen,
    openDialog: openFilterDialog,
    closeDialog: closeFilterDialog,
    updateDraft: updateFilterDraft,
    resetDraft: resetFilterDraft,
    applyDraft: applyFilterDraft
  } = useActivityFilter();
  const visibleIds = useMemo(
    () => new Set(filterActivities(activities, appliedFilter).map((activity) => activity.id)),
    [activities, appliedFilter]
  );
  // フィルタで除外され地図上に表示されなくなったアクティビティは、選択・フォーカス状態からも取り除く
  useEffect(() => {
    pruneToVisible(visibleIds);
  }, [visibleIds, pruneToVisible]);
  // selectedIds（クリック順・重複可）と1:1で対応するアクティビティ一覧をサイドバー表示用に組み立てる
  const selectedActivities = selectedIds
    .map((id) => activities.find((activity) => activity.id === id))
    .filter((activity): activity is CyclingActivity => activity !== undefined);
  const focusedId = focusedIndex === null ? null : (selectedIds[focusedIndex] ?? null);

  const layers = LAYER_DEFINITIONS.map((layerDefinition) => ({
    id: layerDefinition.id,
    name: layerDefinition.name,
    checked: draftVisibility[layerDefinition.id]
  }));

  return (
    <Flex height="100vh">
      <Flex direction="column" flex="1" minWidth="0">
        <Box position="relative" flex="1" minHeight="0">
          <MapView
            layerVisibility={appliedVisibility}
            selectedIds={selectedIds}
            focusedId={focusedId}
            onSelectActivities={selectActivities}
            onActivitiesLoaded={setActivities}
            filter={appliedFilter}
            adminBoundaryEra={appliedEra}
          />
          <MapControls
            onOpenLayerDialog={openLayerDialog}
            onOpenFilterDialog={openFilterDialog}
            onOpenStatisticsDialog={() => setIsStatisticsDialogOpen(true)}
            onOpenSettingsDialog={() => setIsSettingsDialogOpen(true)}
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
        focusedIndex={focusedIndex}
        onFocus={focusActivity}
        onBackFromDetail={clearFocus}
        onBackFromList={clearSelection}
        adminBoundaryEra={appliedEra}
      />
      <LayerDialog
        isOpen={isLayerDialogOpen}
        layers={layers}
        era={draftEra}
        onEraChange={setDraftEra}
        onToggleDraft={toggleLayerDraft}
        onReset={resetLayerDraft}
        onApply={applyLayerDraft}
        onClose={closeLayerDialog}
      />
      <FilterDialog
        isOpen={isFilterDialogOpen}
        draftFilter={draftFilter}
        onUpdateDraft={updateFilterDraft}
        onReset={resetFilterDraft}
        onApply={applyFilterDraft}
        onClose={closeFilterDialog}
      />
      <StatisticsDialog
        isOpen={isStatisticsDialogOpen}
        activities={activities}
        onClose={() => setIsStatisticsDialogOpen(false)}
      />
      <SettingsDialog
        isOpen={isSettingsDialogOpen}
        isBackfillRunning={backfillStatus?.isRunning ?? false}
        onStartBackfill={() => {
          void startBackfill();
        }}
        onStartForceRefetch={() => {
          void startForceRefetch();
        }}
        onClose={() => setIsSettingsDialogOpen(false)}
      />
      <ErrorDialog />
    </Flex>
  );
};
