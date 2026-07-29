import { basename, extname } from 'node:path';
import sharp from 'sharp';
import yazl from 'yazl';
import { convertHeicBufferToJpegBuffer } from './heic-conversion.util';
import { resolveUniquePath } from './monthly-archive.util';
import { isVideoFile, looksLikeVideoContainer } from './video-file.util';
import { forEachZipEntry, openEntryReadStream, readStreamToBuffer, writeYazlOutput } from './zip-streaming.util';

// sharpが内蔵するHEIC/HEIFデコーダ(libheif)はセキュリティ上限に抵触して正当な写真のデコードに
// 失敗することがあるため、この拡張子は`heic-conversion.util.ts`(heif-convert CLI経由)で変換する
const HEIC_EXTENSIONS = new Set(['.heic', '.heif']);

// 実際のHEIC/HEIFファイルはISOBMFFコンテナで、先頭4バイトがボックスサイズ、続く4バイトが
// 'ftyp'という構造を持つ。実データ実行の結果、拡張子が.heic/.heifでも中身が実際には別形式
// （編集アプリでの再保存等によりJPEGへ変わっている等）のファイルが多数存在し、heif-convertが
// 「Input file does not appear to start with a valid box length. Possibly could be a JPEG file
// instead.」というエラーで変換に失敗することが判明した。拡張子だけでなく中身の先頭バイトも
// 確認し、実際にHEIC/HEIFコンテナである場合のみheif-convertへ回す
const ISOBMFF_BOX_TYPE_OFFSET = 4;
const ISOBMFF_FTYP_BOX_TYPE = 'ftyp';

/**
 * バッファの先頭バイトが、実際にISOBMFF（HEIC/HEIFが準拠するコンテナ形式）のftypボックスから
 * 始まっているかどうかを判定する
 * @param buffer 判定対象のバッファ
 * @returns ISOBMFFのftypボックスから始まっている場合true
 */
const looksLikeHeicContainer = (buffer: Buffer): boolean => {
  const ftypBoxEnd = ISOBMFF_BOX_TYPE_OFFSET + ISOBMFF_FTYP_BOX_TYPE.length;
  return (
    buffer.length >= ftypBoxEnd &&
    buffer.subarray(ISOBMFF_BOX_TYPE_OFFSET, ftypBoxEnd).toString('ascii') === ISOBMFF_FTYP_BOX_TYPE
  );
};

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
 * 実際にISOBMFFのftypボックスから始まっているHEIC/HEIFはheif-convert経由でJPEGへ変換する
 * (sharp内蔵のlibheifデコーダはセキュリティ上限に抵触することがあるため)。拡張子が.heic/.heif
 * でも中身が実際には別形式の場合（`looksLikeHeicContainer`参照）は変換せず元のバッファをそのまま
 * 返し、sharp自身の形式判定に委ねる。それ以外の拡張子もsharpがそのままデコードできるため
 * 元のバッファを返す
 * @param originalBuffer 元アーカイブから読み込んだ1エントリ分のバッファ
 * @param fileName エントリのファイル名(拡張子判定に使用)
 * @returns sharpでデコード可能な画像バッファ
 */
const resolveDecodableImageBuffer = (originalBuffer: Buffer, fileName: string): Buffer => {
  const extension = extname(fileName).toLowerCase();
  if (HEIC_EXTENSIONS.has(extension) && looksLikeHeicContainer(originalBuffer)) {
    return convertHeicBufferToJpegBuffer(originalBuffer);
  }
  return originalBuffer;
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
 * HEIC/HEIFは`sharp`に直接渡す前に`resolveDecodableImageBuffer`で変換する（詳細は同関数のTSDoc
 * 参照）。それでも変換・デコードに失敗したエントリは、他の正常なエントリと同様に上記の
 * try/catchで捕捉され`failedEntries`に記録される
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

    try {
      const readStream = await openEntryReadStream(zipFile, entry);
      const originalBuffer = await readStreamToBuffer(readStream);
      // 元アーカイブは動画削除済みのはずだが、念のため動画エントリはサムネイル化の対象から除外する。
      // 拡張子だけでなく中身(ISOBMFFのftyp+メジャーブランド)も確認する。実データで、拡張子が
      // 失われた動画ファイル(iPhoneのLive Photoに付随するQuickTime動画等)が写真として誤処理され
      // サムネイル生成に失敗する事例が見つかったため
      if (isVideoFile(entry.fileName) || looksLikeVideoContainer(originalBuffer)) {
        return;
      }
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
