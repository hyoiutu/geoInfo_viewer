import type { PhotoWithMetadata } from './group-photos-by-year-month.util';

/**
 * 写真一覧を撮影日時（`metadata.takenAt`）の昇順に並び替える。元の配列は変更しない。
 * `splitPhotosIntoSizedParts`でpart分割する前に適用することで、part番号が撮影日時の
 * 連続性を保つようにする（`scanLocalPhotoDirectory`の`readdirSync`はファイルシステムの
 * 列挙順であり撮影日時とは無関係なため、そのままpart分割すると1つのアクティビティの写真が
 * 複数partにまたがりうる。Issue #91）
 * @param photos 並び替え対象の写真一覧
 * @returns 撮影日時の昇順に並び替えた新しい配列
 */
export const sortPhotosByTakenAt = (photos: PhotoWithMetadata[]): PhotoWithMetadata[] =>
  [...photos].sort((a, b) => a.metadata.takenAt.getTime() - b.metadata.takenAt.getTime());
