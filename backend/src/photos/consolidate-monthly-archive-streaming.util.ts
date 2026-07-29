import { basename } from 'node:path';
import yazl from 'yazl';
import type { ConsolidatedKeptEntry, RemovedVideoEntry } from './consolidate-monthly-archive.util';
import { resolveUniquePath } from './monthly-archive.util';
import { isVideoFile, looksLikeVideoContainer } from './video-file.util';
import { forEachZipEntry, openEntryReadStream, readStreamToBuffer, writeYazlOutput } from './zip-streaming.util';

/** ストリーミング統合の入力元となる、ディスク上のアーカイブzipファイル1個分 */
export type StreamingSourceArchive = {
  sourceFileId: string;
  filePath: string;
};

/** consolidateArchiveFilesWithoutVideosStreamingの戻り値 */
export type ConsolidateStreamingResult = {
  keptEntries: ConsolidatedKeptEntry[];
  removedVideoEntries: RemovedVideoEntry[];
};

/**
 * 複数のディスク上アーカイブzipファイルから動画エントリを除いた新しいzipを、ディスク上に
 * ストリーミング（エントリ単位の逐次読み書き）で生成する。`consolidateArchiveWithoutVideos`
 * （backend/src/photos/consolidate-monthly-archive.util.ts）の挙動と同一だが、アーカイブ全体の
 * バイナリを同時にメモリ上へ保持しないため、月合計サイズが大きい（数GB〜十数GB）アーカイブでも
 * Node.jsプロセスのメモリを枯渇させずに処理できる（Issue #99）。
 * 各エントリは、動画かどうかを拡張子だけでなく中身（ISOBMFFのftyp+メジャーブランド、
 * `looksLikeVideoContainer`）でも判定するため、いったんBufferとして読み切ってから判定・
 * 書き込みを行う（`generate-thumbnail-archive-streaming.util.ts`と同じ設計。1エントリ分＝
 * 写真・動画1件、数MB程度のみを一時的にメモリへ保持する形になるが、アーカイブ全体を同時に
 * 保持する問題とは規模が異なり実用上問題ない）
 * @param sources 処理対象の元アーカイブ（ディスク上のファイルパス）一覧
 * @param destZipPath 生成する統合後zipの出力先パス
 * @returns 保持したエントリ・削除した動画エントリの一覧
 */
export const consolidateArchiveFilesWithoutVideosStreaming = async (
  sources: StreamingSourceArchive[],
  destZipPath: string
): Promise<ConsolidateStreamingResult> => {
  const outputZip = new yazl.ZipFile();
  const usedPaths = new Set<string>();
  const keptEntries: ConsolidatedKeptEntry[] = [];
  const removedVideoEntries: RemovedVideoEntry[] = [];

  const writePromise = writeYazlOutput(outputZip, destZipPath);

  for (const source of sources) {
    await forEachZipEntry(source.filePath, async (zipFile, entry) => {
      if (entry.fileName.endsWith('/')) {
        return;
      }

      const readStream = await openEntryReadStream(zipFile, entry);
      const buffer = await readStreamToBuffer(readStream);

      // 拡張子だけでなく中身(ISOBMFFのftyp+メジャーブランド)も確認する。実データで、拡張子が
      // 失われた動画ファイル(iPhoneのLive Photoに付随するQuickTime動画等)が写真として誤って
      // 保持される事例が見つかったため
      if (isVideoFile(entry.fileName) || looksLikeVideoContainer(buffer)) {
        removedVideoEntries.push({ sourceFileId: source.sourceFileId, archivePath: entry.fileName });
        return;
      }

      const newArchivePath = resolveUniquePath(basename(entry.fileName), usedPaths);
      outputZip.addBuffer(buffer, newArchivePath, { compress: false });
      usedPaths.add(newArchivePath);
      keptEntries.push({ sourceFileId: source.sourceFileId, oldArchivePath: entry.fileName, newArchivePath });
    });
  }

  outputZip.end();
  await writePromise;

  return { keptEntries, removedVideoEntries };
};
