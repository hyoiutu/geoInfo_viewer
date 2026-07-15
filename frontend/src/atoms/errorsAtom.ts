import { atom } from 'jotai';
import type { AppErrorInfo } from '../types/apiError';

/**
 * アプリ全体で発生したエラーをスタック（配列）として保持するグローバルステート。
 * 複数箇所（新規アクティビティ取得・バックフィル・通過自治体取得等）で同時にエラーが発生してもどれも見失わないよう、
 * 上書きせず配列末尾に追加する。表示・切り替え・削除はErrorDialogが担う
 */
export const errorsAtom = atom<AppErrorInfo[]>([]);
