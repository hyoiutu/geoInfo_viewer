import type { TakeoutArchiveEntry } from './takeout-archive.util';
import type { PhotoMetadata } from './takeout-metadata.util';

const YEAR_MONTH_SEPARATOR = '-';
const MONTH_DIGITS = 2;

/** 写真本体と抽出済みメタデータの組（グルーピング対象の1件分） */
export type PhotoWithMetadata = {
  /** 写真本体のエントリ */
  entry: TakeoutArchiveEntry;
  /** 抽出済みのメタデータ */
  metadata: PhotoMetadata;
};

/** groupPhotosByYearMonthの戻り値1件分（年月ごとの写真グループ） */
export type YearMonthGroup = {
  /** 撮影年月。'YYYY-MM'形式（UTC基準） */
  yearMonth: string;
  /**
   * 1つの年月をサイズ超過により複数zipへ分割する場合の連番（0始まり）。省略時は0として扱う
   * （`splitPhotosIntoSizedParts`・`backfill-photos-from-local.ts`参照、Issue #23）
   */
  part?: number;
  /** 該当年月（該当partが指定されている場合はそのpartのみ）の写真一覧 */
  photos: PhotoWithMetadata[];
};

/**
 * 撮影日時（UTC基準）から'YYYY-MM'形式の年月文字列を求める
 * @param takenAt 撮影日時
 * @returns 'YYYY-MM'形式の年月文字列
 */
const toYearMonth = (takenAt: Date): string => {
  const year = takenAt.getUTCFullYear();
  const month = String(takenAt.getUTCMonth() + 1).padStart(MONTH_DIGITS, '0');
  return `${year}${YEAR_MONTH_SEPARATOR}${month}`;
};

/**
 * 写真一覧を、撮影日時（UTC基準）の年月ごとにグループ分けする。年月別zip再構成パイプラインが、
 * どの写真をどの月別アーカイブへ振り分けるかを決定するために使う（Issue #23）
 * @param photos メタデータ抽出済みの写真一覧
 * @returns 年月ごとの写真グループ一覧（写真の出現順を保った年月の初出順）
 */
export const groupPhotosByYearMonth = (photos: PhotoWithMetadata[]): YearMonthGroup[] => {
  const groups: YearMonthGroup[] = [];
  const groupsByYearMonth = new Map<string, YearMonthGroup>();

  for (const photo of photos) {
    const yearMonth = toYearMonth(photo.metadata.takenAt);
    let group = groupsByYearMonth.get(yearMonth);
    if (group === undefined) {
      group = { yearMonth, photos: [] };
      groupsByYearMonth.set(yearMonth, group);
      groups.push(group);
    }
    group.photos.push(photo);
  }

  return groups;
};
