import { Box, Button, Flex, Switch, Text } from '@chakra-ui/react';
import { useState } from 'react';
import { layout } from '../theme';
import type { ToggleableLayerId } from '../types/layer';

type LayerSidebarLayer = {
  id: ToggleableLayerId;
  name: string;
  checked: boolean;
};

type LayerSidebarProps = {
  layers: LayerSidebarLayer[];
  onToggleLayer: (id: ToggleableLayerId) => void;
};

export const LayerSidebar = ({ layers, onToggleLayer }: LayerSidebarProps) => {
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
        </Flex>
      )}
    </Box>
  );
};
