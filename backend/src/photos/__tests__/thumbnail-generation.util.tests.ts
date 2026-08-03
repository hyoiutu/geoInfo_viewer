import sharp from 'sharp';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { convertHeicBufferToJpegBuffer } from '../heic-conversion.util';
import { generateThumbnailBuffer, THUMBNAIL_WIDTH_PX } from '../thumbnail-generation.util';

vi.mock('../heic-conversion.util', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../heic-conversion.util')>()),
  convertHeicBufferToJpegBuffer: vi.fn()
}));

const createTestImage = (
  widthPx: number,
  heightPx: number,
  color: { r: number; g: number; b: number }
): Promise<Buffer> => {
  return sharp({ create: { width: widthPx, height: heightPx, channels: 3, background: color } })
    .jpeg()
    .toBuffer();
};

// 実際のHEIC/HEIFファイルが持つISOBMFFのftypボックス(先頭4バイトがボックスサイズ、続く4バイトが
// 'ftyp')を模した先頭バイト列。中身自体の正確なHEICデータではないため、実際のデコードには使えない
const createFakeHeicHeader = (): Buffer => {
  return Buffer.concat([Buffer.from([0x00, 0x00, 0x00, 0x18]), Buffer.from('ftypheic', 'ascii')]);
};

describe('generateThumbnailBufferに関するテスト（Issue #104）', () => {
  beforeEach(() => {
    vi.mocked(convertHeicBufferToJpegBuffer).mockReset();
  });

  test('横600px・縦400pxの画像を、縦横比を維持したまま横300pxへリサイズする', async () => {
    const original = await createTestImage(600, 400, { r: 255, g: 0, b: 0 });

    const result = await generateThumbnailBuffer(original, 'IMG_1.jpg');

    const metadata = await sharp(result).metadata();
    expect(metadata.width).toBe(THUMBNAIL_WIDTH_PX);
    expect(metadata.height).toBe(200);
  });

  test('拡張子が.heic/.heifで中身も実際にISOBMFFのftypボックスから始まる場合、convertHeicBufferToJpegBufferで変換したバッファを使う', async () => {
    const convertedJpeg = await createTestImage(600, 400, { r: 0, g: 255, b: 0 });
    vi.mocked(convertHeicBufferToJpegBuffer).mockReturnValue(convertedJpeg);
    const heicSource = Buffer.concat([createFakeHeicHeader(), Buffer.from('dummy heic payload')]);

    const result = await generateThumbnailBuffer(heicSource, 'IMG_1.heic');

    expect(convertHeicBufferToJpegBuffer).toHaveBeenCalledWith(heicSource);
    const metadata = await sharp(result).metadata();
    expect(metadata.width).toBe(THUMBNAIL_WIDTH_PX);
  });

  test('拡張子が.heic/.heifでも、中身が実際にはISOBMFFのftypボックスから始まっていない場合は、convertHeicBufferToJpegBufferを経由せず直接デコードする', async () => {
    const actuallyJpeg = await createTestImage(600, 400, { r: 255, g: 255, b: 0 });

    const result = await generateThumbnailBuffer(actuallyJpeg, 'IMG_1.HEIC');

    expect(convertHeicBufferToJpegBuffer).not.toHaveBeenCalled();
    const metadata = await sharp(result).metadata();
    expect(metadata.width).toBe(THUMBNAIL_WIDTH_PX);
  });

  test('HEIC変換(convertHeicBufferToJpegBuffer)が失敗した場合、そのエラーをそのまま投げる', async () => {
    vi.mocked(convertHeicBufferToJpegBuffer).mockImplementation(() => {
      throw new Error('heif-convert failed');
    });
    const heicSource = Buffer.concat([createFakeHeicHeader(), Buffer.from('dummy heic payload')]);

    await expect(generateThumbnailBuffer(heicSource, 'IMG_broken.heic')).rejects.toThrow('heif-convert failed');
  });

  test('画像として不正なバッファの場合、エラーを投げる', async () => {
    const corruptImage = Buffer.from('this is not a valid image file');

    await expect(generateThumbnailBuffer(corruptImage, 'IMG_broken.jpg')).rejects.toThrow();
  });
});
