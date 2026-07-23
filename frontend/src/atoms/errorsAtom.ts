import { atom } from 'jotai';
import type { AppErrorInfo } from '../types/apiError';

const errorsStateAtom = atom<AppErrorInfo[]>([]);

/**
 * アプリ全体で発生したエラーをスタック（配列）として保持するグローバルステート（読み取り専用）。
 * 複数箇所（新規アクティビティ取得・バックフィル・通過自治体取得等）で同時にエラーが発生してもどれも見失わないよう、
 * 上書きせず配列末尾に追加する。表示はErrorDialogが担う。
 * 追加・削除は必ずaddErrorAtom/dismissErrorAtomを経由し、外部から配列を直接書き換えることはできない
 */
export const errorsAtom = atom((get) => get(errorsStateAtom));

/** errorsAtomへエラーを1件追加するwrite-only atom */
export const addErrorAtom = atom(null, (get, set, error: AppErrorInfo) => {
  set(errorsStateAtom, [...get(errorsStateAtom), error]);
});

/** errorsAtomから指定indexのエラーを取り除くwrite-only atom */
export const dismissErrorAtom = atom(null, (get, set, index: number) => {
  set(
    errorsStateAtom,
    get(errorsStateAtom).filter((_, currentIndex) => currentIndex !== index)
  );
});
