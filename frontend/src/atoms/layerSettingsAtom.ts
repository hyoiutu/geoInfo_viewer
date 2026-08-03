import { atom } from 'jotai';
import { createDefaultVisibility } from '../constants/layerDefinitions';
import type { LayerVisibility } from '../types/layer';
import { MUNICIPALITY_ERA_CURRENT, type MunicipalityEra } from '../types/municipalityEra';

const layerVisibilityStateAtom = atom<LayerVisibility>(createDefaultVisibility());
const municipalityEraStateAtom = atom<MunicipalityEra>(MUNICIPALITY_ERA_CURRENT);

/**
 * 現在適用中(地図に反映済み)のレイヤー表示/非表示状態（読み取り専用のグローバルステート）。
 * MapView・MapControls・LayerDialogがそれぞれ直接参照し、props経由のバケツリレーは行わない
 * （errorsAtom・isApplyingLayerSettingsAtomと同じ設計判断、Issue #125）。更新は必ず
 * applyLayerSettingsAtomを経由し、外部から直接書き換えることはできない
 */
export const layerVisibilityAtom = atom((get) => get(layerVisibilityStateAtom));

/**
 * 現在適用中(地図に反映済み)の行政区画の年代（読み取り専用のグローバルステート）。
 * MapView・LayerDialog・ActivityDetailSidebar配下のActivityDetailがそれぞれ直接参照し、
 * props経由のバケツリレーは行わない（Issue #125）。更新は必ずapplyLayerSettingsAtomを経由する
 */
export const municipalityEraAtom = atom((get) => get(municipalityEraStateAtom));

/** レイヤーダイアログの「実行」時に、確定したレイヤー表示状態・行政区画の年代を一括で反映するwrite-only atom */
export const applyLayerSettingsAtom = atom(
  null,
  (_get, set, { visibility, era }: { visibility: LayerVisibility; era: MunicipalityEra }) => {
    set(layerVisibilityStateAtom, visibility);
    set(municipalityEraStateAtom, era);
  }
);
