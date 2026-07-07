import { useState } from 'react';
import { LAYER_DEFINITIONS } from '../constants/layerDefinitions';
import type { LayerVisibility, ToggleableLayerId } from '../types/layer';

const createInitialVisibility = (): LayerVisibility =>
  Object.fromEntries(
    LAYER_DEFINITIONS.map((layerDefinition) => [layerDefinition.id, layerDefinition.defaultChecked])
  ) as LayerVisibility;

export const useLayerVisibility = () => {
  const [visibility, setVisibility] = useState<LayerVisibility>(createInitialVisibility);

  const toggleLayer = (id: ToggleableLayerId) => {
    setVisibility((current) => ({ ...current, [id]: !current[id] }));
  };

  return { visibility, toggleLayer };
};
