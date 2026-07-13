import { Flex } from '@chakra-ui/react';
import { useCallback, useState } from 'react';
import type { CyclingActivity } from '../api/activitiesApi';
import { LAYER_DEFINITIONS } from '../constants/layerDefinitions';
import { useActivityFilter } from '../hooks/useActivityFilter';
import { useActivitySelection } from '../hooks/useActivitySelection';
import { useBackfillStatus } from '../hooks/useBackfillStatus';
import { useLayerVisibility } from '../hooks/useLayerVisibility';
import type { AppErrorInfo } from '../types/apiError';
import { ActivityDetailSidebar } from './ActivityDetailSidebar';
import { ErrorDialog } from './ErrorDialog';
import { FilterDialog } from './FilterDialog';
import { LayerSidebar } from './LayerSidebar';
import { MapView } from './MapView';

/**
 * サイドバー・地図・エラーダイアログを組み合わせたアプリのメイン画面。
 * レイヤーの表示状態・初期取り込み進捗・エラー状態・アクティビティの選択状態をここで一元管理し、各コンポーネントへpropsとして渡す
 */
export const MapWorkspace = () => {
  const { visibility, toggleLayer } = useLayerVisibility();
  const [errors, setErrors] = useState<AppErrorInfo[]>([]);
  // 複数箇所（同期・初期取り込み等）で同時にエラーが発生してもどれも見失わないよう、
  // 上書きせずスタック（配列末尾に追加）する。表示・切り替えはErrorDialog側が担う。
  const addError = useCallback((error: AppErrorInfo) => {
    setErrors((current) => [...current, error]);
  }, []);
  const dismissError = useCallback((index: number) => {
    setErrors((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }, []);
  const { backfillStatus, start: startBackfill, startForceRefetch } = useBackfillStatus(addError);
  const [activities, setActivities] = useState<CyclingActivity[]>([]);
  const { selectedIds, focusedIndex, selectActivities, focusActivity, clearFocus, clearSelection } =
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
        onError={addError}
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
        onError={addError}
      />
      <FilterDialog
        isOpen={isFilterDialogOpen}
        draftFilter={draftFilter}
        onUpdateDraft={updateFilterDraft}
        onReset={resetFilterDraft}
        onApply={applyFilterDraft}
        onClose={closeFilterDialog}
      />
      <ErrorDialog errors={errors} onDismiss={dismissError} />
    </Flex>
  );
};
