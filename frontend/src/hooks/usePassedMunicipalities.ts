import { useEffect, useState } from 'react';
import { fetchPassedMunicipalities, type PassedMunicipality } from '../api/activitiesApi';
import type { AppErrorInfo } from '../types/apiError';
import { toAppErrorInfo } from '../utils/apiError';

/** usePassedMunicipalitiesの戻り値 */
type UsePassedMunicipalitiesResult = {
  /** 通過した自治体一覧。取得中または未取得の場合は空配列 */
  municipalities: PassedMunicipality[];
  /** 取得中かどうか */
  isLoading: boolean;
};

/**
 * 指定したアクティビティが通過した自治体一覧を取得するフック。activityIdが変わるたびに再取得する
 * @param activityId 対象のアクティビティID
 * @param onError API呼び出し失敗時に呼ばれるコールバック
 * @returns 通過した自治体一覧と取得中フラグ
 */
export const usePassedMunicipalities = (
  activityId: string,
  onError?: (error: AppErrorInfo) => void
): UsePassedMunicipalitiesResult => {
  const [municipalities, setMunicipalities] = useState<PassedMunicipality[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
          onError?.(toAppErrorInfo(error));
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
  }, [activityId, onError]);

  return { municipalities, isLoading };
};
