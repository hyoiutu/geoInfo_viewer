import { Flex } from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import type { CyclingActivity } from '../api/activitiesApi';
import { LAYER_DEFINITIONS } from '../constants/layerDefinitions';
import { useActivityFilter } from '../hooks/useActivityFilter';
import { useActivitySelection } from '../hooks/useActivitySelection';
import { useBackfillStatus } from '../hooks/useBackfillStatus';
import { useLayerVisibility } from '../hooks/useLayerVisibility';
import { filterActivities } from '../utils/filterActivities';
import { ActivityDetailSidebar } from './ActivityDetailSidebar';
import { ErrorDialog } from './ErrorDialog';
import { FilterDialog } from './FilterDialog';
import { LayerSidebar } from './LayerSidebar';
import { MapView } from './MapView';

/**
 * サイドバー・地図・エラーダイアログを組み合わせたアプリのメイン画面。
 * レイヤーの表示状態・アクティビティの選択状態をここで一元管理し、各コンポーネントへpropsとして渡す。
 * エラー状態はグローバルステート（errorsAtom）で管理するため、ここでは保持しない
 */
export const MapWorkspace = () => {
  const { visibility, toggleLayer } = useLayerVisibility();
  const { backfillStatus, start: startBackfill, startForceRefetch } = useBackfillStatus();
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
    checked: visibility[layerDefinition.id]
  }));

  return (
    <Flex height="100vh">
      <LayerSidebar
        layers={layers}
        onToggleLayer={toggleLayer}
        backfillStatus={backfillStatus}
        onStartBackfill={() => {
          void startBackfill();
        }}
        onStartForceRefetch={() => {
          void startForceRefetch();
        }}
        onOpenFilterDialog={openFilterDialog}
      />
      <MapView
        layerVisibility={visibility}
        selectedIds={selectedIds}
        focusedId={focusedId}
        onSelectActivities={selectActivities}
        onActivitiesLoaded={setActivities}
        filter={appliedFilter}
      />
      <ActivityDetailSidebar
        activities={selectedActivities}
        focusedIndex={focusedIndex}
        onFocus={focusActivity}
        onBackFromDetail={clearFocus}
        onBackFromList={clearSelection}
      />
      <FilterDialog
        isOpen={isFilterDialogOpen}
        draftFilter={draftFilter}
        onUpdateDraft={updateFilterDraft}
        onReset={resetFilterDraft}
        onApply={applyFilterDraft}
        onClose={closeFilterDialog}
      />
      <ErrorDialog />
    </Flex>
  );
};
