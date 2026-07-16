import { useEffect, useState } from 'react';
import { fetchPassedMunicipalities, type PassedMunicipality } from '../api/activitiesApi';
import { MUNICIPALITY_ERA_CURRENT, type MunicipalityEra } from '../types/municipalityEra';
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
 * 指定したアクティビティが通過した自治体一覧を取得するフック。activityId・eraが変わるたびに再取得する。
 * エラーはグローバルなエラースタック（useErrorReporter）へ報告する
 * @param activityId 対象のアクティビティID
 * @param era 判定に使う行政区画の年代識別子（省略時は現行）
 * @returns 通過した自治体一覧と取得中フラグ
 */
export const usePassedMunicipalities = (
  activityId: string,
  era: MunicipalityEra = MUNICIPALITY_ERA_CURRENT
): UsePassedMunicipalitiesResult => {
  const [municipalities, setMunicipalities] = useState<PassedMunicipality[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const addError = useErrorReporter();

  // activityId・eraが変わるたびに取得し直す。フォーカス先の切り替えが速い場合に古い結果で上書きしないよう、
  // アンマウント/依存値変化時にキャンセルフラグを立てる
  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);
    setMunicipalities([]);

    fetchPassedMunicipalities(activityId, era)
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
  }, [activityId, era, addError]);

  return { municipalities, isLoading };
};
