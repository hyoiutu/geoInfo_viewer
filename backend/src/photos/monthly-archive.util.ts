import { basename, extname } from 'node:path';
import AdmZip from 'adm-zip';
import type { PhotoWithMetadata } from './group-photos-by-year-month.util';

const DUPLICATE_SUFFIX_START = 2;
// adm-zipのzip内エントリ圧縮方式定数(STORED=無圧縮)。adm-zipのパッケージ自体はこれをexportしていないため
// ここに直接定義する（node_modules/adm-zip/util/constants.js参照）
const ZIP_COMPRESSION_METHOD_STORED = 0;

/** mergeMonthlyArchiveの戻り値のうち、追加した写真1件分（元の写真とマージ後アーカイブ内でのパス） */
export type MergedMonthlyArchiveEntry = {
  /** 追加対象の写真 */
  photo: PhotoWithMetadata;
  /** マージ後のzip内でのエントリパス（同名衝突がある場合は連番が付く） */
  archivePath: string;
};

/** mergeMonthlyArchiveの戻り値 */
export type MergedMonthlyArchive = {
  /** マージ後のzipファイル本体 */
  zipBuffer: Buffer;
  /** 追加した写真ごとの、マージ後アーカイブ内でのパス */
  entries: MergedMonthlyArchiveEntry[];
};

/**
 * 指定したファイル名が既存パス集合と衝突しない場合はそのまま、衝突する場合は
 * 拡張子の直前に連番（-2, -3, ...）を付けて衝突しない名前を求める
 * @param fileName 希望するファイル名
 * @param usedPaths 既に使用済みのパス集合
 * @returns 衝突しないファイル名
 */
const resolveUniquePath = (fileName: string, usedPaths: Set<string>): string => {
  if (!usedPaths.has(fileName)) {
    return fileName;
  }

  const extension = extname(fileName);
  const stem = extension.length > 0 ? fileName.slice(0, -extension.length) : fileName;

  let suffix = DUPLICATE_SUFFIX_START;
  let candidate = `${stem}-${suffix}${extension}`;
  while (usedPaths.has(candidate)) {
    suffix += 1;
    candidate = `${stem}-${suffix}${extension}`;
  }
  return candidate;
};

/**
 * 既存の月別アーカイブzip（無ければ新規作成）に、新規の写真エントリ一覧を追記する。
 * 元のTakeout zip内でのディレクトリ構造は保持せず、ファイル名（basename）のみを使う。
 * 異なる元zip由来で同名ファイルが衝突する場合は連番を付けて回避する（Issue #23）。
 * 新規エントリはSTORED（無圧縮）で追加する。写真・動画は既に圧縮済みの形式でありDEFLATE圧縮の
 * サイズ削減効果がほぼ無い一方、adm-zipの既定であるDEFLATE圧縮はCPUバウンドな処理のため、
 * GB規模になりうる月別アーカイブでは圧縮自体が実行時間を大きく圧迫することが実際に判明した
 * （写真ローカルバックフィルの実行時、Issue #23）
 * @param existingZipBuffer 既存の月別アーカイブzip本体。まだ存在しない年月の場合はnull
 * @param newPhotos 追記する写真一覧
 * @returns マージ後のzip本体と、追記した写真ごとの最終的なアーカイブ内パス
 */
export const mergeMonthlyArchive = (
  existingZipBuffer: Buffer | null,
  newPhotos: PhotoWithMetadata[]
): MergedMonthlyArchive => {
  const zip = existingZipBuffer !== null ? new AdmZip(existingZipBuffer) : new AdmZip();
  const usedPaths = new Set(zip.getEntries().map((entry) => entry.entryName));

  const entries: MergedMonthlyArchiveEntry[] = [];
  for (const photo of newPhotos) {
    const archivePath = resolveUniquePath(basename(photo.entry.path), usedPaths);
    const entry = zip.addFile(archivePath, photo.entry.data);
    entry.header.method = ZIP_COMPRESSION_METHOD_STORED;
    usedPaths.add(archivePath);
    entries.push({ photo, archivePath });
  }

  return { zipBuffer: zip.toBuffer(), entries };
};
