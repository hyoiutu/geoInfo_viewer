import { Flex } from '@chakra-ui/react';
import { useState } from 'react';
import { LAYER_DEFINITIONS } from '../constants/layerDefinitions';
import { useBackfillStatus } from '../hooks/useBackfillStatus';
import { useLayerVisibility } from '../hooks/useLayerVisibility';
import type { AppErrorInfo } from '../types/apiError';
import { ErrorDialog } from './ErrorDialog';
import { LayerSidebar } from './LayerSidebar';
import { MapView } from './MapView';

export const MapWorkspace = () => {
  const { visibility, toggleLayer } = useLayerVisibility();
  const [error, setError] = useState<AppErrorInfo | null>(null);
  const { backfillStatus, start: startBackfill } = useBackfillStatus(setError);

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
      <MapView layerVisibility={visibility} onError={setError} />
      <ErrorDialog error={error} onClose={() => setError(null)} />
    </Flex>
  );
};
