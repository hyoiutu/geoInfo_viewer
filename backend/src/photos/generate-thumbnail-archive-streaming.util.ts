import { basename } from 'node:path';
import sharp from 'sharp';
import yazl from 'yazl';
import { resolveUniquePath } from './monthly-archive.util';
import { isVideoFile } from './video-file.util';
import { addStreamEntryAndWait, forEachZipEntry, openEntryReadStream, writeYazlOutput } from './zip-streaming.util';

/** グリッド・吹き出し表示用サムネイルの横幅（px）。縦横比は維持する（Issue #100） */
export const THUMBNAIL_WIDTH_PX = 300;

/** generateThumbnailArchiveStreamingの戻り値のうち、生成したサムネイル1件分 */
export type ThumbnailArchiveEntry = {
  /** サムネイルzip内でのエントリパス（元アーカイブと同じファイル名。衝突時は連番を付ける） */
  archivePath: string;
};

/** generateThumbnailArchiveStreamingの戻り値 */
export type GenerateThumbnailArchiveResult = {
  entries: ThumbnailArchiveEntry[];
};

/**
 * 動画削除・part統合済み（Issue #97 / #99）の月別アーカイブzip（ディスク上のパス）を読み込み、
 * 各写真エントリを横`THUMBNAIL_WIDTH_PX`px・縦横比維持でリサイズしたサムネイルzipを、
 * ディスク上にストリーミング（エントリ単位の逐次読み書き）で生成する（Issue #100）。
 * `zip-streaming.util.ts`の共通ヘルパーを`consolidateArchiveFilesWithoutVideosStreaming`
 * （Issue #99）と共用し、各エントリの読み込みストリームを`sharp`のリサイズ変換ストリームへ
 * 通してから出力zipへ追加することで、写真1件分の全バイナリを同時にメモリへ保持せずに処理する
 * @param sourceZipPath 処理対象の元アーカイブ（ディスク上のファイルパス）
 * @param destZipPath 生成するサムネイルzipの出力先パス
 * @returns 生成したサムネイルエントリの一覧
 */
export const generateThumbnailArchiveStreaming = async (
  sourceZipPath: string,
  destZipPath: string
): Promise<GenerateThumbnailArchiveResult> => {
  const outputZip = new yazl.ZipFile();
  const usedPaths = new Set<string>();
  const entries: ThumbnailArchiveEntry[] = [];

  const writePromise = writeYazlOutput(outputZip, destZipPath);

  await forEachZipEntry(sourceZipPath, async (zipFile, entry) => {
    if (entry.fileName.endsWith('/')) {
      return;
    }
    // 元アーカイブは動画削除済みのはずだが、念のため動画エントリはサムネイル化の対象から除外する
    if (isVideoFile(entry.fileName)) {
      return;
    }

    const archivePath = resolveUniquePath(basename(entry.fileName), usedPaths);
    const readStream = await openEntryReadStream(zipFile, entry);
    const thumbnailStream = readStream.pipe(sharp().resize({ width: THUMBNAIL_WIDTH_PX }));
    await addStreamEntryAndWait(outputZip, thumbnailStream, archivePath);
    usedPaths.add(archivePath);
    entries.push({ archivePath });
  });

  outputZip.end();
  await writePromise;

  return { entries };
};
