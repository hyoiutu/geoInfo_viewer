import { atom } from 'jotai';
import { clearPendingLayerApplyFlag, type PendingLayerApply } from '../utils/pendingLayerApply';

const pendingLayerApplyStateAtom = atom<PendingLayerApply | null>(null);

/**
 * レイヤーダイアログの実行に伴う非同期処理（行政区画データ取得・自転車ログ同期）が完了しておらず、
 * 待機状態が継続中かどうかを表すグローバルステート（読み取り専用）。待機中はレイヤーダイアログ自身の
 * 入力・クローズ手段を無効化する（LayerDialog/AppDialog）ために参照する。更新は必ず
 * startPendingLayerApplyAtom/clearPendingLayerApplyFlagAtomを経由し、外部から直接書き換えることはできない
 * （Issue #65、PR #110レビュー対応。ユーザー指示によりuseState + props経由からグローバルステートへ変更）
 */
export const isApplyingLayerSettingsAtom = atom((get) => {
  const pendingLayerApply = get(pendingLayerApplyStateAtom);
  return (
    pendingLayerApply !== null && (pendingLayerApply.waitingForAdminBoundary || pendingLayerApply.waitingForCyclingLog)
  );
});

/** レイヤーダイアログの実行開始時に、完了を待つ対象を記録するwrite-only atom */
export const startPendingLayerApplyAtom = atom(null, (_get, set, pendingLayerApply: PendingLayerApply) => {
  set(pendingLayerApplyStateAtom, pendingLayerApply);
});

/** 指定した非同期処理が完了した時点で、対応するフラグのみをfalseにするwrite-only atom */
export const clearPendingLayerApplyFlagAtom = atom(null, (get, set, field: keyof PendingLayerApply) => {
  set(pendingLayerApplyStateAtom, clearPendingLayerApplyFlag(field)(get(pendingLayerApplyStateAtom)));
});
