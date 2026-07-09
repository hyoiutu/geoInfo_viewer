import { Box, Button, Flex, Switch, Text } from '@chakra-ui/react';
import { useState } from 'react';
import type { BackfillStatus } from '../api/activitiesApi';
import { layout } from '../theme';
import type { ToggleableLayerId } from '../types/layer';

const SECONDS_PER_MINUTE = 60;

type LayerSidebarLayer = {
  id: ToggleableLayerId;
  name: string;
  checked: boolean;
};

type LayerSidebarProps = {
  layers: LayerSidebarLayer[];
  onToggleLayer: (id: ToggleableLayerId) => void;
  backfillStatus: BackfillStatus | null;
  onStartBackfill: () => void;
};

export const LayerSidebar = ({ layers, onToggleLayer, backfillStatus, onStartBackfill }: LayerSidebarProps) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const handleToggleExpand = () => {
    setIsExpanded((current) => !current);
  };

  return (
    <Box
      width={isExpanded ? layout.sidebarWidth : layout.sidebarCollapsedWidth}
      flexShrink={0}
      height="100vh"
      borderRight="1px solid"
      borderColor="border"
      overflow="hidden"
      transition="width 0.2s ease"
    >
      <Flex justifyContent="flex-end" padding="2">
        <Button
          onClick={handleToggleExpand}
          size="sm"
          variant="ghost"
          aria-label={isExpanded ? 'サイドバーを折りたたむ' : 'サイドバーを展開する'}
        >
          {isExpanded ? '«' : '»'}
        </Button>
      </Flex>
      {isExpanded && (
        <Flex direction="column" gap="3" padding="4" paddingTop="0">
          {layers.map((layer) => (
            <Switch.Root key={layer.id} checked={layer.checked} onCheckedChange={() => onToggleLayer(layer.id)}>
              <Switch.HiddenInput />
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              <Switch.Label>
                <Text>{layer.name}</Text>
              </Switch.Label>
            </Switch.Root>
          ))}
          <Box borderTop="1px solid" borderColor="border" paddingTop="3">
            <Button onClick={onStartBackfill} disabled={backfillStatus?.isRunning ?? false} size="sm" width="100%">
              自転車ログ初期取り込み
            </Button>
            {backfillStatus?.isRunning && (
              <Box marginTop="2">
                <Text fontSize="sm">
                  {backfillStatus.progressPercent}%（{backfillStatus.completedCount} / {backfillStatus.totalCount}）
                </Text>
                {backfillStatus.estimatedRemainingSeconds !== null && (
                  <Text fontSize="sm">
                    残り約{Math.ceil(backfillStatus.estimatedRemainingSeconds / SECONDS_PER_MINUTE)}分
                  </Text>
                )}
              </Box>
            )}
          </Box>
        </Flex>
      )}
    </Box>
  );
};
