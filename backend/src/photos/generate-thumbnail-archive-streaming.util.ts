import { basename } from 'node:path';
import sharp from 'sharp';
import yazl from 'yazl';
import { resolveUniquePath } from './monthly-archive.util';
import { isVideoFile } from './video-file.util';
import { forEachZipEntry, openEntryReadStream, writeYazlOutput } from './zip-streaming.util';

/** グリッド・吹き出し表示用サムネイルの横幅（px）。縦横比は維持する（Issue #100） */
export const THUMBNAIL_WIDTH_PX = 300;

/** generateThumbnailArchiveStreamingの戻り値のうち、生成したサムネイル1件分 */
export type ThumbnailArchiveEntry = {
  /** サムネイルzip内でのエントリパス（元アーカイブと同じファイル名。衝突時は連番を付ける） */
  archivePath: string;
};

/** generateThumbnailArchiveStreamingの戻り値のうち、サムネイル生成に失敗した1件分 */
export type FailedThumbnailEntry = {
  /** 元アーカイブ内でのエントリパス */
  archivePath: string;
  /** 失敗理由（エラーメッセージ） */
  reason: string;
};

/** generateThumbnailArchiveStreamingの戻り値 */
export type GenerateThumbnailArchiveResult = {
  entries: ThumbnailArchiveEntry[];
  failedEntries: FailedThumbnailEntry[];
};

/**
 * 1件分のReadableストリームを最後まで読み切り、Bufferとして返す
 */
const readStreamToBuffer = (stream: NodeJS.ReadableStream): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
};

/**
 * 動画削除・part統合済み（Issue #97 / #99）の月別アーカイブzip（ディスク上のパス）を読み込み、
 * 各写真エントリを横`THUMBNAIL_WIDTH_PX`px・縦横比維持でリサイズしたサムネイルzipを、
 * ディスク上に生成する（Issue #100）。
 *
 * 元アーカイブ側の読み込みはエントリ単位のストリーミング（`zip-streaming.util.ts`）で行い
 * アーカイブ全体を同時にメモリへ保持しないが、1エントリ分（写真1件、数MB程度）は`sharp`での
 * リサイズのためにいったんBufferとして読み切ってから処理する。これは、yazlの出力ストリームへ
 * 追加した後に読み込み側でエラーが発生すると、yazlの内部キューが後続エントリの書き込みへ
 * 進めなくなる恐れがあるため。実際に、一部のHEIC写真でlibheifのセキュリティ上限
 * （iref boxの参照数が16件を超える）に抵触してデコードに失敗する事例が見つかっており、
 * この失敗を出力zipへ触れる前（yazlへ登録する前）に検知できるよう、Buffer化してから
 * `sharp().toBuffer()`が成功した場合のみ`addBuffer`で出力zipへ追加する設計にした。
 * これにより、1件のエントリの処理失敗が他のエントリ・年月全体の処理を巻き込んで止めることはない
 * @param sourceZipPath 処理対象の元アーカイブ（ディスク上のファイルパス）
 * @param destZipPath 生成するサムネイルzipの出力先パス
 * @returns 生成に成功したサムネイルエントリ・失敗したエントリの一覧
 */
export const generateThumbnailArchiveStreaming = async (
  sourceZipPath: string,
  destZipPath: string
): Promise<GenerateThumbnailArchiveResult> => {
  const outputZip = new yazl.ZipFile();
  const usedPaths = new Set<string>();
  const entries: ThumbnailArchiveEntry[] = [];
  const failedEntries: FailedThumbnailEntry[] = [];

  const writePromise = writeYazlOutput(outputZip, destZipPath);

  await forEachZipEntry(sourceZipPath, async (zipFile, entry) => {
    if (entry.fileName.endsWith('/')) {
      return;
    }
    // 元アーカイブは動画削除済みのはずだが、念のため動画エントリはサムネイル化の対象から除外する
    if (isVideoFile(entry.fileName)) {
      return;
    }

    try {
      const readStream = await openEntryReadStream(zipFile, entry);
      const originalBuffer = await readStreamToBuffer(readStream);
      const thumbnailBuffer = await sharp(originalBuffer).resize({ width: THUMBNAIL_WIDTH_PX }).toBuffer();

      const archivePath = resolveUniquePath(basename(entry.fileName), usedPaths);
      outputZip.addBuffer(thumbnailBuffer, archivePath, { compress: false });
      usedPaths.add(archivePath);
      entries.push({ archivePath });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.error(`[thumbnail] ${entry.fileName}のサムネイル生成に失敗したためスキップします:`, error);
      failedEntries.push({ archivePath: entry.fileName, reason });
    }
  });

  outputZip.end();
  await writePromise;

  return { entries, failedEntries };
};
