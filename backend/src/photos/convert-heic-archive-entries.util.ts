import { basename, extname } from 'node:path';
import AdmZip from 'adm-zip';
import { convertHeicBufferToJpegBuffer, isActualHeicFile } from './heic-conversion.util';
import { resolveUniquePath, ZIP_COMPRESSION_METHOD_STORED } from './monthly-archive.util';

const JPEG_EXTENSION = '.jpg';

/** convertHeicArchiveEntriesの戻り値のうち、変換に成功した1件分 */
export type ConvertedArchiveEntry = {
  /** 変換前（HEIC）のアーカイブ内パス */
  originalArchivePath: string;
  /** 変換後（JPEG）のアーカイブ内パス。拡張子を.jpgへ変更し、衝突する場合は連番を付ける */
  archivePath: string;
};

/** convertHeicArchiveEntriesの戻り値のうち、変換に失敗した1件分 */
export type FailedArchiveEntry = {
  /** 元のアーカイブ内パス（変換に失敗したため変更されない） */
  archivePath: string;
  /** 失敗理由（エラーメッセージ） */
  reason: string;
};

/** convertHeicArchiveEntriesの戻り値 */
export type ConvertHeicArchiveEntriesResult = {
  /** 変換後のzip本体 */
  zipBuffer: Buffer;
  /** 変換に成功したエントリ一覧 */
  converted: ConvertedArchiveEntry[];
  /** 変換に失敗したエントリ一覧 */
  failed: FailedArchiveEntry[];
};

/**
 * 月別アーカイブzip内の指定エントリのうち、実際にHEIC/HEIFであるものをJPEGへ変換し、
 * `.jpg`拡張子のエントリへ置き換える（元のHEICバイト列・エントリは残さない、検討事項の
 * 回答(a)を採用。Issue #106）。`targetArchivePaths`はファイル名の拡張子で事前に絞り込まれた
 * 候補を想定するが、`isActualHeicFile`で中身も再確認し、拡張子だけHEICで実際には別形式
 * （編集アプリでの再保存等）のエントリは変換せずそのまま残す（サムネイル生成、Issue #100と同じ方針）。
 * 1件のエントリの変換に失敗しても、元のエントリを残したまま他のエントリの変換を継続する
 * （`generateThumbnailArchiveStreaming`と同じ「1件の失敗が全体を巻き込まない」設計）
 * @param zipBuffer 変換対象の月別アーカイブzip本体
 * @param targetArchivePaths 変換対象として絞り込み済みのアーカイブ内パス一覧（HEIC/HEIF拡張子の写真）
 * @returns 変換後のzip本体と、変換に成功・失敗したエントリの一覧
 */
export const convertHeicArchiveEntries = (
  zipBuffer: Buffer,
  targetArchivePaths: string[]
): ConvertHeicArchiveEntriesResult => {
  const zip = new AdmZip(zipBuffer);
  const usedPaths = new Set(zip.getEntries().map((entry) => entry.entryName));
  const converted: ConvertedArchiveEntry[] = [];
  const failed: FailedArchiveEntry[] = [];

  for (const archivePath of targetArchivePaths) {
    const entry = zip.getEntry(archivePath);
    if (entry === null) {
      continue;
    }

    const originalBuffer = entry.getData();
    if (!isActualHeicFile(archivePath, originalBuffer)) {
      continue;
    }

    try {
      const jpegBuffer = convertHeicBufferToJpegBuffer(originalBuffer);

      usedPaths.delete(archivePath);
      const stem = basename(archivePath, extname(archivePath));
      const newArchivePath = resolveUniquePath(`${stem}${JPEG_EXTENSION}`, usedPaths);

      zip.deleteFile(archivePath);
      const newEntry = zip.addFile(newArchivePath, jpegBuffer);
      newEntry.header.method = ZIP_COMPRESSION_METHOD_STORED;
      usedPaths.add(newArchivePath);

      converted.push({ originalArchivePath: archivePath, archivePath: newArchivePath });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      failed.push({ archivePath, reason });
    }
  }

  return { zipBuffer: zip.toBuffer(), converted, failed };
};
