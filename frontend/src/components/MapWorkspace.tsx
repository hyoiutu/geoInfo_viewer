import { Box, Flex } from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import type { CyclingActivity } from '../api/activitiesApi';
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
  const { backfillStatus, start: startBackfill, startForceRefetch } = useBackfillStatus();
  const { isVisible: isBackfillFooterVisible, dismiss: dismissBackfillFooter } =
    useBackfillProgressFooter(backfillStatus);
  const { activities } = useCyclingActivities(visibility['bicycle-log']);
  const filteredActivities = useMemo(() => filterActivities(activities, filter), [activities, filter]);
  const { selectedIds, focusedIndex, selectActivities, focusActivity, clearFocus, clearSelection, pruneToVisible } =
    useActivitySelection();
  const visibleIds = useMemo(() => new Set(filteredActivities.map((activity) => activity.id)), [filteredActivities]);
  // フィルタで除外され地図上に表示されなくなったアクティビティは、選択・フォーカス状態からも取り除く
  useEffect(() => {
    pruneToVisible(visibleIds);
  }, [visibleIds, pruneToVisible]);
  // selectedIds（クリック順・重複可）と1:1で対応するアクティビティ一覧をサイドバー表示用に組み立てる
  const selectedActivities = selectedIds
    .map((id) => activities.find((activity) => activity.id === id))
    .filter((activity): activity is CyclingActivity => activity !== undefined);
  const focusedId = focusedIndex === null ? null : (selectedIds[focusedIndex] ?? null);

  const handleApplyLayerSettings = (nextVisibility: LayerVisibility, nextEra: MunicipalityEra) => {
    setVisibility(nextVisibility);
    setEra(nextEra);
  };

  return (
    <Flex height="100vh">
      <Flex direction="column" flex="1" minWidth="0">
        <Box position="relative" flex="1" minHeight="0">
          <MapView
            layerVisibility={visibility}
            selectedIds={selectedIds}
            focusedId={focusedId}
            onSelectActivities={selectActivities}
            filteredActivities={filteredActivities}
            adminBoundaryEra={era}
          />
          <MapControls
            appliedVisibility={visibility}
            appliedEra={era}
            onApplyLayerSettings={handleApplyLayerSettings}
            appliedFilter={filter}
            onApplyFilter={setFilter}
            activities={activities}
            isBackfillRunning={backfillStatus?.isRunning ?? false}
            onStartBackfill={() => {
              void startBackfill();
            }}
            onStartForceRefetch={() => {
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
        focusedIndex={focusedIndex}
        onFocus={focusActivity}
        onBackFromDetail={clearFocus}
        onBackFromList={clearSelection}
        adminBoundaryEra={era}
      />
      <ErrorDialog />
    </Flex>
  );
};
