import { Flex, IconButton } from '@chakra-ui/react';
import { ChartColumn, Funnel, Layers, Settings } from 'lucide-react';

/** MapControlsのprops */
type MapControlsProps = {
  /** レイヤーアイコンが押されたときに呼ばれるコールバック */
  onOpenLayerDialog: () => void;
  /** フィルタアイコンが押されたときに呼ばれるコールバック */
  onOpenFilterDialog: () => void;
  /** 統計アイコンが押されたときに呼ばれるコールバック */
  onOpenStatisticsDialog: () => void;
  /** 設定アイコン(歯車)が押されたときに呼ばれるコールバック */
  onOpenSettingsDialog: () => void;
};

/**
 * 地図の表示を邪魔しないよう地図右下に配置する、レイヤー・フィルタ・統計・設定ダイアログを開くアイコンボタン群。
 * 左サイドバーの廃止に伴い、これらの操作をMap Controlsへ集約する（Issue #32）
 */
export const MapControls = ({
  onOpenLayerDialog,
  onOpenFilterDialog,
  onOpenStatisticsDialog,
  onOpenSettingsDialog
}: MapControlsProps) => (
  <Flex position="absolute" bottom="4" right="4" direction="column" gap="2">
    <IconButton onClick={onOpenLayerDialog} aria-label="レイヤー切り替え" size="md" borderRadius="full" shadow="md">
      <Layers />
    </IconButton>
    <IconButton onClick={onOpenFilterDialog} aria-label="自転車ログ フィルタ" size="md" borderRadius="full" shadow="md">
      <Funnel />
    </IconButton>
    <IconButton onClick={onOpenStatisticsDialog} aria-label="統計データ" size="md" borderRadius="full" shadow="md">
      <ChartColumn />
    </IconButton>
    <IconButton onClick={onOpenSettingsDialog} aria-label="設定" size="md" borderRadius="full" shadow="md">
      <Settings />
    </IconButton>
  </Flex>
);
