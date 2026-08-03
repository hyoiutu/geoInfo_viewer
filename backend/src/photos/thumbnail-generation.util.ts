import sharp from 'sharp';
import { convertHeicBufferToJpegBuffer, isActualHeicFile } from './heic-conversion.util';

/** グリッド・吹き出し表示用サムネイルの横幅（px）。縦横比は維持する（Issue #100） */
export const THUMBNAIL_WIDTH_PX = 300;

/**
 * サムネイル生成用にsharpでデコード可能な画像バッファを解決する。
 * 実際にISOBMFFのftypボックスから始まっているHEIC/HEIFはheif-convert経由でJPEGへ変換する
 * (sharp内蔵のlibheifデコーダはセキュリティ上限に抵触することがあるため)。拡張子が.heic/.heif
 * でも中身が実際には別形式の場合（`isActualHeicFile`参照）は変換せず元のバッファをそのまま
 * 返し、sharp自身の形式判定に委ねる。それ以外の拡張子もsharpがそのままデコードできるため
 * 元のバッファを返す
 * @param originalBuffer 元の写真1件分のバッファ
 * @param fileName ファイル名(拡張子判定に使用)
 * @returns sharpでデコード可能な画像バッファ
 */
const resolveDecodableImageBuffer = (originalBuffer: Buffer, fileName: string): Buffer => {
  if (isActualHeicFile(fileName, originalBuffer)) {
    return convertHeicBufferToJpegBuffer(originalBuffer);
  }
  return originalBuffer;
};

/**
 * 写真1件分のバッファから、横`THUMBNAIL_WIDTH_PX`px・縦横比維持でリサイズしたサムネイルバッファを
 * 生成する。月別アーカイブzipから生成する経路（`generate-thumbnail-archive-streaming.util.ts`、
 * Issue #100）・写真ローカルバックフィル前のローカルディレクトリから生成する経路
 * （`strip-videos-and-generate-thumbnails-locally.ts`、Issue #104）の両方から使う共通処理
 * @param originalBuffer 元の写真1件分のバッファ
 * @param fileName ファイル名(拡張子判定に使用)
 * @returns サムネイルのバッファ（JPEG等、sharpの既定の出力形式）
 * @throws デコード・リサイズに失敗した場合（画像として不正なバッファ、HEIC変換の失敗等）
 */
export const generateThumbnailBuffer = async (originalBuffer: Buffer, fileName: string): Promise<Buffer> => {
  const decodableBuffer = resolveDecodableImageBuffer(originalBuffer, fileName);
  return sharp(decodableBuffer).resize({ width: THUMBNAIL_WIDTH_PX }).toBuffer();
};
