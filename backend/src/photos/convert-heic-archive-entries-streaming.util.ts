import { basename, extname } from 'node:path';
import yazl from 'yazl';
import { convertHeicBufferToJpegBuffer, isActualHeicFile } from './heic-conversion.util';
import { resolveUniquePath } from './monthly-archive.util';
import { forEachZipEntry, openEntryReadStream, readStreamToBuffer, writeYazlOutput } from './zip-streaming.util';

const JPEG_EXTENSION = '.jpg';

/** convertHeicArchiveEntriesStreamingの戻り値のうち、変換に成功した1件分 */
export type ConvertedArchiveEntry = {
  /** 変換前（HEIC）のアーカイブ内パス */
  originalArchivePath: string;
  /** 変換後（JPEG）のアーカイブ内パス。拡張子を.jpgへ変更し、衝突する場合は連番を付ける */
  archivePath: string;
};

/** convertHeicArchiveEntriesStreamingの戻り値のうち、変換に失敗した1件分 */
export type FailedArchiveEntry = {
  /** 元のアーカイブ内パス（変換に失敗したため変更されない） */
  archivePath: string;
  /** 失敗理由（エラーメッセージ） */
  reason: string;
};

/** convertHeicArchiveEntriesStreamingの戻り値 */
export type ConvertHeicArchiveEntriesResult = {
  /** 変換に成功したエントリ一覧 */
  converted: ConvertedArchiveEntry[];
  /** 変換に失敗したエントリ一覧 */
  failed: FailedArchiveEntry[];
};

/**
 * zip内の全エントリ名を、中身を読み込まずに収集する。変換後の新しいファイル名（`.jpg`）が
 * 既存のどのエントリとも衝突しないことを保証するため、実際の変換処理を始める前に全件を
 * 把握しておく必要がある（下記`convertHeicArchiveEntriesStreaming`のTSDoc参照）
 * @param zipPath 走査対象のzip（ディスク上のファイルパス）
 * @returns zip内の全エントリ名（ディレクトリエントリを除く）
 */
const collectEntryNames = async (zipPath: string): Promise<string[]> => {
  const names: string[] = [];
  await forEachZipEntry(zipPath, async (_zipFile, entry) => {
    if (!entry.fileName.endsWith('/')) {
      names.push(entry.fileName);
    }
  });
  return names;
};

/**
 * ディスク上の月別アーカイブzip（`sourceZipPath`）を読み込み、`targetArchivePaths`のうち実際に
 * HEIC/HEIFであるエントリのみJPEGへ変換して`.jpg`拡張子のエントリへ置き換えた新しいzipを、
 * `destZipPath`へストリーミング（エントリ単位の逐次読み書き）で生成する（元のHEICバイト列・
 * エントリは残さない、検討事項の回答(a)を採用。Issue #106）。
 *
 * `convertHeicArchiveEntries`（旧実装、Buffer全体をメモリへ読み込みAdmZipでランダムアクセス編集する
 * 方式）から、`generate-thumbnail-archive-streaming.util.ts`・`consolidate-monthly-archive-streaming.util.ts`
 * と同じストリーミング方式へ変更した（PR #116レビュー対応）。既存アーカイブは月合計サイズが
 * 数GB〜十数GBになりうり、Buffer全体をメモリへ載せる方式では`generate-thumbnail-archives.ts`が
 * ストリーミング方式へ切り替える契機となったOOM事故（Issue #99、16GB機で16.6GB単一zipの処理に
 * 失敗）を再発させるリスクがあったため。1エントリ分（写真1件、数MB程度）のみを一時的にBufferとして
 * 保持する（アーカイブ全体を同時に保持する問題とは規模が異なり実用上問題ない）。
 *
 * 変換前に`collectEntryNames`で全エントリ名を1度収集してから本処理を行う2パス構成にしている。
 * 単純に1パスでストリーミング処理すると、変換対象エントリ（例: `IMG_1.heic`）より後ろのエントリ
 * （例: 既存の`IMG_1.jpg`）とのファイル名衝突を、そのエントリへ到達するまで検出できず、
 * 出力zip内に同名エントリが重複してしまう恐れがある
 * @param sourceZipPath 処理対象の元アーカイブ（ディスク上のファイルパス）
 * @param destZipPath 生成する変換後zipの出力先パス
 * @param targetArchivePaths 変換対象として絞り込み済みのアーカイブ内パス一覧（HEIC/HEIF拡張子の写真）
 * @returns 変換に成功・失敗したエントリの一覧
 */
export const convertHeicArchiveEntriesStreaming = async (
  sourceZipPath: string,
  destZipPath: string,
  targetArchivePaths: string[]
): Promise<ConvertHeicArchiveEntriesResult> => {
  const targetPaths = new Set(targetArchivePaths);
  const usedPaths = new Set(await collectEntryNames(sourceZipPath));
  const converted: ConvertedArchiveEntry[] = [];
  const failed: FailedArchiveEntry[] = [];

  const outputZip = new yazl.ZipFile();
  const writePromise = writeYazlOutput(outputZip, destZipPath);

  await forEachZipEntry(sourceZipPath, async (zipFile, entry) => {
    if (entry.fileName.endsWith('/')) {
      return;
    }

    const readStream = await openEntryReadStream(zipFile, entry);
    const originalBuffer = await readStreamToBuffer(readStream);

    if (!targetPaths.has(entry.fileName) || !isActualHeicFile(entry.fileName, originalBuffer)) {
      outputZip.addBuffer(originalBuffer, entry.fileName, { compress: false });
      return;
    }

    try {
      const jpegBuffer = convertHeicBufferToJpegBuffer(originalBuffer);

      usedPaths.delete(entry.fileName);
      const stem = basename(entry.fileName, extname(entry.fileName));
      const newArchivePath = resolveUniquePath(`${stem}${JPEG_EXTENSION}`, usedPaths);
      usedPaths.add(newArchivePath);

      outputZip.addBuffer(jpegBuffer, newArchivePath, { compress: false });
      converted.push({ originalArchivePath: entry.fileName, archivePath: newArchivePath });
    } catch (error) {
      outputZip.addBuffer(originalBuffer, entry.fileName, { compress: false });
      const reason = error instanceof Error ? error.message : String(error);
      failed.push({ archivePath: entry.fileName, reason });
    }
  });

  outputZip.end();
  await writePromise;

  return { converted, failed };
};
