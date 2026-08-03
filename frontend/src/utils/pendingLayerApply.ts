/**
 * レイヤーダイアログの実行によって発生した非同期処理（行政区画データ取得・自転車ログ同期）のうち、
 * まだ完了していないものを表す。いずれもfalseになった時点でレイヤーダイアログを閉じてよい（Issue #65）
 */
export type PendingLayerApply = {
  /** 行政区画データの取得・地図への反映がまだ完了していないか */
  waitingForAdminBoundary: boolean;
  /** 自転車ログの同期・参照取得がまだ完了していないか */
  waitingForCyclingLog: boolean;
};

/**
 * `pendingLayerApply`のうち指定フィールドのみを完了(false)にする更新関数を返す。
 * 行政区画データ取得・自転車ログ同期のいずれの完了ハンドラからも共通で使う（Issue #65レビュー対応、
 * SRPに則りコンポーネントファイルからutils/へ切り出し。PR #110レビュー対応）
 */
export const clearPendingLayerApplyFlag =
  (field: keyof PendingLayerApply) =>
  (current: PendingLayerApply | null): PendingLayerApply | null =>
    current ? { ...current, [field]: false } : current;
