import type { CyclingActivity } from '../api/activitiesApi';

/**
 * アクティビティ一覧からIDで1件を探す
 * @param activities 検索対象のアクティビティ一覧
 * @param id 探すID。nullの場合は常にnullを返す
 * @returns 見つかったアクティビティ。無い場合はnull
 */
export const findActivityById = (activities: CyclingActivity[], id: string | null): CyclingActivity | null => {
  if (id === null) {
    return null;
  }
  return activities.find((activity) => activity.id === id) ?? null;
};
