import { useEffect, useState } from 'react';
import { fetchPassedMunicipalities, type PassedMunicipality } from '../api/activitiesApi';
import { toAppErrorInfo } from '../utils/apiError';
import { useErrorReporter } from './useErrorReporter';

/** usePassedMunicipalitiesの戻り値 */
type UsePassedMunicipalitiesResult = {
  /** 通過した自治体一覧。取得中または未取得の場合は空配列 */
  municipalities: PassedMunicipality[];
  /** 取得中かどうか */
  isLoading: boolean;
};

/**
 * 指定したアクティビティが通過した自治体一覧を取得するフック。activityIdが変わるたびに再取得する。
 * エラーはグローバルなエラースタック（useErrorReporter）へ報告する
 * @param activityId 対象のアクティビティID
 * @returns 通過した自治体一覧と取得中フラグ
 */
export const usePassedMunicipalities = (activityId: string): UsePassedMunicipalitiesResult => {
  const [municipalities, setMunicipalities] = useState<PassedMunicipality[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const addError = useErrorReporter();

  // activityIdが変わるたびに取得し直す。フォーカス先の切り替えが速い場合に古い結果で上書きしないよう、
  // アンマウント/依存値変化時にキャンセルフラグを立てる
  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);
    setMunicipalities([]);

    fetchPassedMunicipalities(activityId)
      .then((result) => {
        if (!isCancelled) {
          setMunicipalities(result);
        }
      })
      .catch((error: unknown) => {
        if (!isCancelled) {
          addError(toAppErrorInfo(error));
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [activityId, addError]);

  return { municipalities, isLoading };
};
