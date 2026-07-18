import { Flex, IconButton } from '@chakra-ui/react';
import { ChartColumn, Funnel, Layers, Settings } from 'lucide-react';
import { useState } from 'react';
import type { CyclingActivity } from '../api/activitiesApi';
import type { ActivityFilter } from '../types/activityFilter';
import type { LayerVisibility } from '../types/layer';
import type { MunicipalityEra } from '../types/municipalityEra';
import { FilterDialog } from './FilterDialog';
import { LayerDialog } from './LayerDialog';
import { SettingsDialog } from './SettingsDialog';
import { StatisticsDialog } from './StatisticsDialog';

/** MapControlsのprops */
type MapControlsProps = {
  /** 現在適用中(地図に反映済み)のレイヤー表示/非表示状態 */
  appliedVisibility: LayerVisibility;
  /** 現在適用中(地図に反映済み)の行政区画の年代 */
  appliedEra: MunicipalityEra;
  /** レイヤーダイアログで実行が押されたときに、確定した表示状態・年代を渡して呼ばれるコールバック */
  onApplyLayerSettings: (visibility: LayerVisibility, era: MunicipalityEra) => void;
  /** 現在適用中(地図に反映済み)のフィルタ条件 */
  appliedFilter: ActivityFilter;
  /** フィルタダイアログで実行が押されたときに、確定したフィルタ条件を渡して呼ばれるコールバック */
  onApplyFilter: (filter: ActivityFilter) => void;
  /** 統計ダイアログの集計対象となる全アクティビティ一覧 */
  activities: CyclingActivity[];
  /** バックフィル・フォースリフェッチのいずれかが実行中かどうか */
  isBackfillRunning: boolean;
  /** 初期取り込みボタンが押されたときに呼ばれるコールバック */
  onStartBackfill: () => void;
  /** 強制再取得ボタンが押されたときに呼ばれるコールバック */
  onStartForceRefetch: () => void;
};

/**
 * 地図の表示を邪魔しないよう地図右下に配置する、レイヤー・フィルタ・統計・設定の各アイコンボタンと、
 * それぞれが開くダイアログ本体をまとめて保持するコンポーネント。開閉状態は本コンポーネントが自身の
 * useStateで管理し、確定した結果（適用状態）のみを呼び出し元（MapWorkspace）へコールバックで返す（Issue #53）
 */
export const MapControls = ({
  appliedVisibility,
  appliedEra,
  onApplyLayerSettings,
  appliedFilter,
  onApplyFilter,
  activities,
  isBackfillRunning,
  onStartBackfill,
  onStartForceRefetch
}: MapControlsProps) => {
  const [isLayerDialogOpen, setIsLayerDialogOpen] = useState(false);
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [isStatisticsDialogOpen, setIsStatisticsDialogOpen] = useState(false);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);

  const handleApplyLayerSettings = (visibility: LayerVisibility, era: MunicipalityEra) => {
    onApplyLayerSettings(visibility, era);
    setIsLayerDialogOpen(false);
  };

  const handleApplyFilter = (filter: ActivityFilter) => {
    onApplyFilter(filter);
    setIsFilterDialogOpen(false);
  };

  const handleStartBackfill = () => {
    onStartBackfill();
    setIsSettingsDialogOpen(false);
  };

  const handleStartForceRefetch = () => {
    onStartForceRefetch();
    setIsSettingsDialogOpen(false);
  };

  return (
    <>
      <Flex position="absolute" bottom="4" right="4" direction="column" gap="2">
        <IconButton
          onClick={() => setIsLayerDialogOpen(true)}
          aria-label="レイヤー切り替え"
          size="md"
          borderRadius="full"
          shadow="md"
        >
          <Layers />
        </IconButton>
        <IconButton
          onClick={() => setIsFilterDialogOpen(true)}
          aria-label="自転車ログ フィルタ"
          size="md"
          borderRadius="full"
          shadow="md"
        >
          <Funnel />
        </IconButton>
        <IconButton
          onClick={() => setIsStatisticsDialogOpen(true)}
          aria-label="統計データ"
          size="md"
          borderRadius="full"
          shadow="md"
        >
          <ChartColumn />
        </IconButton>
        <IconButton
          onClick={() => setIsSettingsDialogOpen(true)}
          aria-label="設定"
          size="md"
          borderRadius="full"
          shadow="md"
        >
          <Settings />
        </IconButton>
      </Flex>
      <LayerDialog
        isOpen={isLayerDialogOpen}
        appliedVisibility={appliedVisibility}
        appliedEra={appliedEra}
        onApply={handleApplyLayerSettings}
        onClose={() => setIsLayerDialogOpen(false)}
      />
      <FilterDialog
        isOpen={isFilterDialogOpen}
        appliedFilter={appliedFilter}
        onApply={handleApplyFilter}
        onClose={() => setIsFilterDialogOpen(false)}
      />
      <StatisticsDialog
        isOpen={isStatisticsDialogOpen}
        activities={activities}
        onClose={() => setIsStatisticsDialogOpen(false)}
      />
      <SettingsDialog
        isOpen={isSettingsDialogOpen}
        isBackfillRunning={isBackfillRunning}
        onStartBackfill={handleStartBackfill}
        onStartForceRefetch={handleStartForceRefetch}
        onClose={() => setIsSettingsDialogOpen(false)}
      />
    </>
  );
};
