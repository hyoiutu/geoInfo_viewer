import { useEffect, useState } from 'react';
import { fetchPhotos, type Photo } from '../api/activitiesApi';
import { toAppErrorInfo } from '../utils/apiError';
import { useErrorReporter } from './useErrorReporter';

/** usePhotosの戻り値 */
type UsePhotosResult = {
  /** 撮影された写真一覧。取得中または未取得の場合は空配列 */
  photos: Photo[];
  /** 取得中かどうか */
  isLoading: boolean;
};

/**
 * 指定したアクティビティの開始・終了日時の範囲で撮影された写真一覧を取得するフック。
 * activityIdが変わるたびに再取得する。エラーはグローバルなエラースタック（useErrorReporter）へ報告する
 * @param activityId 対象のアクティビティID
 * @returns 写真一覧と取得中フラグ
 */
export const usePhotos = (activityId: string): UsePhotosResult => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const addError = useErrorReporter();

  // activityIdが変わるたびに取得し直す。フォーカス先の切り替えが速い場合に古い結果で上書きしないよう、
  // アンマウント/依存値変化時にキャンセルフラグを立てる
  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);
    setPhotos([]);

    fetchPhotos(activityId)
      .then((result) => {
        if (!isCancelled) {
          setPhotos(result);
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

  return { photos, isLoading };
};
