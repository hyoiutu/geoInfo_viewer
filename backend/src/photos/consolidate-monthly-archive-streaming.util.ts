import { createWriteStream } from 'node:fs';
import { basename } from 'node:path';
import yauzl from 'yauzl';
import yazl from 'yazl';
import type { ConsolidatedKeptEntry, RemovedVideoEntry } from './consolidate-monthly-archive.util';
import { resolveUniquePath } from './monthly-archive.util';
import { isVideoFile } from './video-file.util';

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
 * yauzlでzipエントリを1件ずつ開き、Readableストリームとして返す（Promise化）
 */
const openEntryReadStream = (zipFile: yauzl.ZipFile, entry: yauzl.Entry): Promise<NodeJS.ReadableStream> => {
  return new Promise((resolve, reject) => {
    zipFile.openReadStream(entry, (error, readStream) => {
      if (error || !readStream) {
        reject(error ?? new Error(`failed to open read stream for entry: ${entry.fileName}`));
        return;
      }
      resolve(readStream);
    });
  });
};

/**
 * 指定したzipファイルパスを開き、エントリを1件ずつ処理する。yauzlの`lazyEntries`により
 * 次のエントリはコールバック側で明示的に`readEntry()`を呼ぶまで読み進めない。
 * `onEntry`は、そのエントリの後続処理（書き込み先への転送等）が完全に完了してから
 * resolveすること。yauzlは同一zipFileに対して複数エントリを同時並行で読み進める前提の
 * 実装になっていないため、前エントリの処理完了を待たずに次のreadEntry()を呼ぶと
 * 読み込み内容が壊れる恐れがある
 */
const forEachZipEntry = (
  zipPath: string,
  onEntry: (zipFile: yauzl.ZipFile, entry: yauzl.Entry) => Promise<void>
): Promise<void> => {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (openError, zipFile) => {
      if (openError || !zipFile) {
        reject(openError ?? new Error(`failed to open zip: ${zipPath}`));
        return;
      }

      zipFile.readEntry();
      zipFile.on('entry', (entry) => {
        onEntry(zipFile, entry)
          .then(() => zipFile.readEntry())
          .catch(reject);
      });
      zipFile.on('end', resolve);
      zipFile.on('error', reject);
    });
  });
};

/**
 * yazlの出力を指定パスへ書き出すストリームを開始し、完了を待つPromiseを返す
 */
const writeYazlOutput = (zipFile: yazl.ZipFile, destZipPath: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const writeStream = createWriteStream(destZipPath);
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
    zipFile.outputStream.pipe(writeStream);
  });
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
      // このエントリがyazlによって出力ストリームへ完全に転送し終わるまで待ってから
      // 次のエントリへ進む。yauzlは同一zipFileに対する並行読み込みを想定していないため
      await new Promise<void>((resolve, reject) => {
        readStream.on('end', resolve);
        readStream.on('error', reject);
        outputZip.addReadStream(readStream, newArchivePath, { compress: false });
      });
      usedPaths.add(newArchivePath);
      keptEntries.push({ sourceFileId: source.sourceFileId, oldArchivePath: entry.fileName, newArchivePath });
    });
  }

  outputZip.end();
  await writePromise;

  return { keptEntries, removedVideoEntries };
};
