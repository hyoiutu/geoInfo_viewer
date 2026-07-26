import { basename, extname } from 'node:path';
import sharp from 'sharp';
import yazl from 'yazl';
import { convertHeicBufferToJpegBuffer } from './heic-conversion.util';
import { resolveUniquePath } from './monthly-archive.util';
import { extractJpegFromMotionPhoto } from './motion-photo.util';
import { isVideoFile } from './video-file.util';
import { forEachZipEntry, openEntryReadStream, writeYazlOutput } from './zip-streaming.util';

// sharpが内蔵するHEIC/HEIFデコーダ(libheif)はセキュリティ上限に抵触して正当な写真のデコードに
// 失敗することがあるため、この拡張子は`heic-conversion.util.ts`(heif-convert CLI経由)で変換する
const HEIC_EXTENSIONS = new Set(['.heic', '.heif']);
// Android Motion Photo。JPEG本体の後ろにMP4動画データが連結されておりsharpはそのままデコードできないため、
// `motion-photo.util.ts`で先頭のJPEG部分のみを抽出してから渡す
const MOTION_PHOTO_EXTENSION = '.mp';

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
 * サムネイル生成用にsharpでデコード可能な画像バッファを解決する。
 * Android Motion Photo(`.mp`)は先頭のJPEG部分を抽出し、HEIC/HEIFはheif-convert経由でJPEGへ
 * 変換する(sharp内蔵のlibheifデコーダはセキュリティ上限に抵触することがあるため)。
 * それ以外の拡張子はsharpがそのままデコードできるため元のバッファをそのまま返す
 * @param originalBuffer 元アーカイブから読み込んだ1エントリ分のバッファ
 * @param fileName エントリのファイル名(拡張子判定に使用)
 * @returns sharpでデコード可能な画像バッファ
 */
const resolveDecodableImageBuffer = (originalBuffer: Buffer, fileName: string): Buffer => {
  const extension = extname(fileName).toLowerCase();
  if (extension === MOTION_PHOTO_EXTENSION) {
    return extractJpegFromMotionPhoto(originalBuffer);
  }
  if (HEIC_EXTENSIONS.has(extension)) {
    return convertHeicBufferToJpegBuffer(originalBuffer);
  }
  return originalBuffer;
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
 * 進めなくなる恐れがあるため。この失敗を出力zipへ触れる前（yazlへ登録する前）に検知できるよう、
 * Buffer化してから`sharp().toBuffer()`が成功した場合のみ`addBuffer`で出力zipへ追加する設計にした。
 * これにより、1件のエントリの処理失敗が他のエントリ・年月全体の処理を巻き込んで止めることはない。
 *
 * HEIC/HEIF・Android Motion Photo(`.mp`)は`sharp`に直接渡す前に`resolveDecodableImageBuffer`で
 * 変換・抽出する（詳細は同関数のTSDoc参照）。それでも変換・デコードに失敗したエントリは、他の
 * 正常なエントリと同様に上記のtry/catchで捕捉され`failedEntries`に記録される
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
      const decodableBuffer = resolveDecodableImageBuffer(originalBuffer, entry.fileName);
      const thumbnailBuffer = await sharp(decodableBuffer).resize({ width: THUMBNAIL_WIDTH_PX }).toBuffer();

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
