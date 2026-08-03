import type { LayerVisibility } from '../types/layer';
import type { MunicipalityEra } from '../types/municipalityEra';

/** resolveLayerSettingsChangeの戻り値 */
export type LayerSettingsChange = {
  /** 行政区画の年代が変わるか（変わる場合、境界データの取得が発生する） */
  willChangeEra: boolean;
  /** 自転車ログレイヤーがOFF→ONになるか（なる場合、Strava同期が発生する） */
  willSyncCyclingLog: boolean;
};

/**
 * レイヤーダイアログの実行によって、非同期処理（行政区画データ取得・自転車ログ同期）が
 * 実際に発生するかどうかを判定する。`MapControls.tsx`（ダイアログを即座に閉じてよいかの判定）・
 * `MapWorkspace.tsx`（完了を待つ対象の記録）の両方が同じ判定を必要とするため共通化した
 * （DRY、PR #110レビュー対応）
 * @param currentVisibility 現在適用中のレイヤー表示/非表示状態
 * @param currentEra 現在適用中の行政区画の年代
 * @param nextVisibility 実行により次に適用される表示/非表示状態
 * @param nextEra 実行により次に適用される行政区画の年代
 * @returns 発生する非同期処理の内訳
 */
export const resolveLayerSettingsChange = (
  currentVisibility: LayerVisibility,
  currentEra: MunicipalityEra,
  nextVisibility: LayerVisibility,
  nextEra: MunicipalityEra
): LayerSettingsChange => ({
  willChangeEra: nextEra !== currentEra,
  willSyncCyclingLog: nextVisibility['bicycle-log'] && !currentVisibility['bicycle-log']
});
