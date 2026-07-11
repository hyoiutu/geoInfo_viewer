import { useState } from 'react';
import { LAYER_DEFINITIONS } from '../constants/layerDefinitions';
import type { LayerVisibility, ToggleableLayerId } from '../types/layer';

/** @returns LAYER_DEFINITIONSのdefaultCheckedを反映した初期表示状態 */
const createInitialVisibility = (): LayerVisibility =>
  Object.fromEntries(
    LAYER_DEFINITIONS.map((layerDefinition) => [layerDefinition.id, layerDefinition.defaultChecked])
  ) as LayerVisibility;

/** useLayerVisibilityの戻り値 */
type UseLayerVisibilityResult = {
  /** レイヤーIDごとの表示/非表示状態 */
  visibility: LayerVisibility;
  /** 指定したレイヤーの表示/非表示を反転させる関数 */
  toggleLayer: (id: ToggleableLayerId) => void;
};

/**
 * 各レイヤーの表示/非表示状態を管理するフック
 * @returns 表示状態と切り替え関数
 */
export const useLayerVisibility = (): UseLayerVisibilityResult => {
  const [visibility, setVisibility] = useState<LayerVisibility>(createInitialVisibility);

  const toggleLayer = (id: ToggleableLayerId) => {
    setVisibility((current) => ({ ...current, [id]: !current[id] }));
  };

  return { visibility, toggleLayer };
};
