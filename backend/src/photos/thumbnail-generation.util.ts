import { extname } from 'node:path';
import sharp from 'sharp';
import { convertHeicBufferToJpegBuffer } from './heic-conversion.util';

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

/**
 * サムネイル生成用にsharpでデコード可能な画像バッファを解決する。
 * 実際にISOBMFFのftypボックスから始まっているHEIC/HEIFはheif-convert経由でJPEGへ変換する
 * (sharp内蔵のlibheifデコーダはセキュリティ上限に抵触することがあるため)。拡張子が.heic/.heif
 * でも中身が実際には別形式の場合（`looksLikeHeicContainer`参照）は変換せず元のバッファをそのまま
 * 返し、sharp自身の形式判定に委ねる。それ以外の拡張子もsharpがそのままデコードできるため
 * 元のバッファを返す
 * @param originalBuffer 元の写真1件分のバッファ
 * @param fileName ファイル名(拡張子判定に使用)
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
