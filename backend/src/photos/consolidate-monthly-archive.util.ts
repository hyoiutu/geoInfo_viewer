import { basename } from 'node:path';
import AdmZip from 'adm-zip';
import { resolveUniquePath, ZIP_COMPRESSION_METHOD_STORED } from './monthly-archive.util';
import { isVideoFile } from './video-file.util';

/** consolidateArchiveWithoutVideosへ渡す、統合対象の元アーカイブ1エントリ分 */
export type ArchiveSourceEntry = {
  /** エントリの元となったGoogle DriveファイルID（既存のmonthly_photo_archives.drive_file_id） */
  sourceFileId: string;
  /** 元アーカイブ内でのエントリパス（既存のphotos.archive_path） */
  archivePath: string;
  /** エントリの実バイナリ */
  data: Buffer;
};

/** consolidateArchiveWithoutVideosの戻り値のうち、保持した写真1件分 */
export type ConsolidatedKeptEntry = {
  /** エントリの元となったGoogle DriveファイルID */
  sourceFileId: string;
  /** 統合前の元アーカイブ内でのエントリパス */
  oldArchivePath: string;
  /** 統合後の新規アーカイブ内でのエントリパス（同名衝突がある場合は連番が付く） */
  newArchivePath: string;
};

/** consolidateArchiveWithoutVideosの戻り値のうち、動画として除外した1件分 */
export type RemovedVideoEntry = {
  /** エントリの元となったGoogle DriveファイルID */
  sourceFileId: string;
  /** 元アーカイブ内でのエントリパス */
  archivePath: string;
};

/** consolidateArchiveWithoutVideosの戻り値 */
export type ConsolidatedArchive = {
  /** 統合後の新規zipファイル本体（動画を除いた写真のみ） */
  zipBuffer: Buffer;
  /** 保持した写真ごとの、統合後アーカイブ内での新しいパス */
  keptEntries: ConsolidatedKeptEntry[];
  /** 動画として除外したエントリ一覧 */
  removedVideoEntries: RemovedVideoEntry[];
};

/**
 * 1つ以上の元アーカイブ（同一年月、サイズ超過により複数partへ分割されていた場合は複数）から
 * 読み込んだ全エントリを受け取り、動画エントリを除外した上で1つの新規zipへ統合する。
 * 写真グリッド表示に動画は使われておらず容量のみを圧迫していたため、動画を削除し、
 * 併せてpart分割された年月を単一のzipへ統合する（Issue #97）。
 * 異なる元アーカイブ由来で同名ファイルが衝突する場合は`resolveUniquePath`で連番を付けて回避する
 * （`mergeMonthlyArchive`と共通のロジック）。新規エントリはSTORED（無圧縮）で追加する
 * @param entries 統合対象の元アーカイブから読み込んだ全エントリ（写真・動画を問わない）
 * @returns 統合後のzip本体、保持した写真ごとの新しいパス、除外した動画一覧
 */
export const consolidateArchiveWithoutVideos = (entries: ArchiveSourceEntry[]): ConsolidatedArchive => {
  const zip = new AdmZip();
  const usedPaths = new Set<string>();

  const keptEntries: ConsolidatedKeptEntry[] = [];
  const removedVideoEntries: RemovedVideoEntry[] = [];

  for (const entry of entries) {
    if (isVideoFile(entry.archivePath)) {
      removedVideoEntries.push({ sourceFileId: entry.sourceFileId, archivePath: entry.archivePath });
      continue;
    }

    const newArchivePath = resolveUniquePath(basename(entry.archivePath), usedPaths);
    const zipEntry = zip.addFile(newArchivePath, entry.data);
    zipEntry.header.method = ZIP_COMPRESSION_METHOD_STORED;
    usedPaths.add(newArchivePath);
    keptEntries.push({ sourceFileId: entry.sourceFileId, oldArchivePath: entry.archivePath, newArchivePath });
  }

  return { zipBuffer: zip.toBuffer(), keptEntries, removedVideoEntries };
};
