import { basename } from 'node:path';
import yazl from 'yazl';
import type { ConsolidatedKeptEntry, RemovedVideoEntry } from './consolidate-monthly-archive.util';
import { resolveUniquePath } from './monthly-archive.util';
import { isVideoFile } from './video-file.util';
import { addStreamEntryAndWait, forEachZipEntry, openEntryReadStream, writeYazlOutput } from './zip-streaming.util';

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
 * （backend/src/photos/consolidate-monthly-archive.util.ts）の挙動と同一だが、全エントリの
 * バイナリを同時にメモリ上へ保持しないため、月合計サイズが大きい（数GB〜十数GB）アーカイブでも
 * Node.jsプロセスのメモリを枯渇させずに処理できる（Issue #99）
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

  // 出力先への書き込みパイプは、エントリを追加し始める前に開始しておく必要がある。
  // yazlは追加されたエントリを順番に１つずつ実際の出力ストリームへ流し込むため、パイプが
  // 開始されていない状態でaddReadStreamしたエントリの読み込みストリームは、データを
  // 誰にも消費されないまま止まってしまう（後続のreadEntry()呼び出しが永久に発火しない）
  const writePromise = writeYazlOutput(outputZip, destZipPath);

  for (const source of sources) {
    await forEachZipEntry(source.filePath, async (zipFile, entry) => {
      if (entry.fileName.endsWith('/')) {
        return;
      }

      if (isVideoFile(entry.fileName)) {
        removedVideoEntries.push({ sourceFileId: source.sourceFileId, archivePath: entry.fileName });
        return;
      }

      const newArchivePath = resolveUniquePath(basename(entry.fileName), usedPaths);
      const readStream = await openEntryReadStream(zipFile, entry);
      await addStreamEntryAndWait(outputZip, readStream, newArchivePath);
      usedPaths.add(newArchivePath);
      keptEntries.push({ sourceFileId: source.sourceFileId, oldArchivePath: entry.fileName, newArchivePath });
    });
  }

  outputZip.end();
  await writePromise;

  return { keptEntries, removedVideoEntries };
};
