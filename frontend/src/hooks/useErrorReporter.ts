import { useSetAtom } from 'jotai';
import { useCallback } from 'react';
import { errorsAtom } from '../atoms/errorsAtom';
import type { AppErrorInfo } from '../types/apiError';

/**
 * グローバルなエラースタック（errorsAtom）へエラーを追加する関数を返すフック。
 * API呼び出し等でエラーが発生しうる箇所は、propsでコールバックを受け取らずこのフックを直接使う
 * @returns エラーを1件追加する関数
 */
export const useErrorReporter = (): ((error: AppErrorInfo) => void) => {
  const setErrors = useSetAtom(errorsAtom);
  return useCallback(
    (error: AppErrorInfo) => {
      setErrors((current) => [...current, error]);
    },
    [setErrors]
  );
};
