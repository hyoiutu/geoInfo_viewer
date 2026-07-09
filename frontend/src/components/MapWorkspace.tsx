import { Flex } from '@chakra-ui/react';
import { LAYER_DEFINITIONS } from '../constants/layerDefinitions';
import { useBackfillStatus } from '../hooks/useBackfillStatus';
import { useLayerVisibility } from '../hooks/useLayerVisibility';
import { LayerSidebar } from './LayerSidebar';
import { MapView } from './MapView';

export const MapWorkspace = () => {
  const { visibility, toggleLayer } = useLayerVisibility();
  const { status: backfillStatus, start: startBackfill } = useBackfillStatus();

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
      />
      <MapView layerVisibility={visibility} />
    </Flex>
  );
};
