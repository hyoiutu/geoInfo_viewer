import sharp from 'sharp';
import { describe, expect, test } from 'vitest';
import { extractJpegFromMotionPhoto } from '../motion-photo.util';

const createTestJpeg = (): Promise<Buffer> => {
  return sharp({ create: { width: 10, height: 10, channels: 3, background: { r: 255, g: 0, b: 0 } } })
    .jpeg()
    .toBuffer();
};

// Android Motion PhotoのMP4部分先頭(ftypボックス)を模したバイト列。
// 実際のftypボックスは「4バイトのボックスサイズ + 'ftyp' + メジャーブランド('isom'等)」という構造を持つ
const createFakeMp4FtypBox = (): Buffer => {
  return Buffer.concat([Buffer.from([0x00, 0x00, 0x00, 0x18]), Buffer.from('ftypisom', 'ascii')]);
};

describe('extractJpegFromMotionPhotoに関するテスト', () => {
  test('JPEGの後ろにMP4のftypボックスが連結されたバッファから、先頭のJPEG部分のみを抽出する', async () => {
    const jpeg = await createTestJpeg();
    const motionPhoto = Buffer.concat([jpeg, createFakeMp4FtypBox(), Buffer.from('dummy video bytes')]);

    const extracted = extractJpegFromMotionPhoto(motionPhoto);

    expect(extracted.equals(jpeg)).toBe(true);
    const metadata = await sharp(extracted).metadata();
    expect(metadata.width).toBe(10);
    expect(metadata.height).toBe(10);
  });

  test('ftypボックスが見つからない場合はエラーを投げる', () => {
    const buffer = Buffer.from('this buffer has no mp4 box at all');

    expect(() => extractJpegFromMotionPhoto(buffer)).toThrow();
  });

  test('ftypボックスの直前にボックスサイズ分の余白(4バイト)が無い場合はエラーを投げる', () => {
    const buffer = Buffer.from('ftypisom');

    expect(() => extractJpegFromMotionPhoto(buffer)).toThrow();
  });

  test('ftypボックスがバッファの先頭(4バイト目)にあり、抽出結果が空になる場合はエラーを投げる（JPEG先頭+動画後続という構造を持たないMotion Photo）', () => {
    // createFakeMp4FtypBox()自体が「4バイトのボックスサイズ+'ftyp'」のみで構成されており、
    // 'ftyp'の開始位置はインデックス4（=手前にJPEG本体が入る余地が無い）
    const buffer = createFakeMp4FtypBox();

    expect(() => extractJpegFromMotionPhoto(buffer)).toThrow();
  });
});
