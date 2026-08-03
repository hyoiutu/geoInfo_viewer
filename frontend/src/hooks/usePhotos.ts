import { useSetAtom } from 'jotai';
import { useEffect, useState } from 'react';
import { fetchPhotos, type Photo } from '../api/activitiesApi';
import { addErrorAtom } from '../atoms/errorsAtom';
import { toAppErrorInfo } from '../utils/apiError';

/** usePhotosの戻り値 */
type UsePhotosResult = {
  /** 撮影された写真一覧。取得中または未取得の場合は空配列 */
  photos: Photo[];
  /** 取得中かどうか */
  isLoading: boolean;
};

/**
 * 指定したアクティビティの開始・終了日時の範囲で撮影された写真一覧を取得するフック。
 * activityIdが変わるたびに再取得する。エラーはグローバルなエラースタック（errorsAtom）へ報告する。
 * activityIdがnull（未フォーカス）の場合は取得を行わず、空配列・isLoading falseを返す
 * （地図上の写真吹き出し表示、Issue #107でも本フックをそのまま使うために対応）
 * @param activityId 対象のアクティビティID。未フォーカスの場合はnull
 * @returns 写真一覧と取得中フラグ
 */
export const usePhotos = (activityId: string | null): UsePhotosResult => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(activityId !== null);
  const addError = useSetAtom(addErrorAtom);

  // activityIdが変わるたびに取得し直す。フォーカス先の切り替えが速い場合に古い結果で上書きしないよう、
  // アンマウント/依存値変化時にキャンセルフラグを立てる
  useEffect(() => {
    if (activityId === null) {
      setIsLoading(false);
      setPhotos([]);
      return;
    }

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
