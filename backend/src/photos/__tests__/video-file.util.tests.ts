import { describe, expect, test } from 'vitest';
import { isVideoFile, looksLikeVideoContainer } from '../video-file.util';

describe('isVideoFileに関するテスト', () => {
  test.each([
    ['IMG_1234.mp4', true],
    ['IMG_1234.MP4', true],
    ['IMG_1234.mov', true],
    ['IMG_1234.MOV', true],
    ['IMG_1234.avi', true],
    ['IMG_1234.mkv', true],
    ['IMG_1234.3gp', true],
    ['IMG_1234.webm', true],
    ['MAH00074.m4v', true],
    ['IMG_1234.jpg', false],
    ['IMG_1234.jpeg', false],
    ['IMG_1234.png', false],
    ['IMG_1234.heic', false],
    ['IMG_1234.json', false]
  ])('ファイル名%sの場合、%sを返す', (fileName, expected) => {
    expect(isVideoFile(fileName)).toBe(expected);
  });
});

// 実際のISOBMFFのftypボックスは「4バイトのボックスサイズ + 'ftyp' + 4バイトのメジャーブランド + ...」
// という構造を持つ
const createFtypBuffer = (majorBrand: string): Buffer => {
  return Buffer.concat([
    Buffer.from([0x00, 0x00, 0x00, 0x14]),
    Buffer.from('ftyp', 'ascii'),
    Buffer.from(majorBrand, 'ascii')
  ]);
};

describe('looksLikeVideoContainerに関するテスト', () => {
  test('メジャーブランドがQuickTime動画("qt  ")の場合、trueを返す', () => {
    expect(looksLikeVideoContainer(createFtypBuffer('qt  '))).toBe(true);
  });

  test('メジャーブランドがHEIC("heic")の場合、falseを返す', () => {
    expect(looksLikeVideoContainer(createFtypBuffer('heic'))).toBe(false);
  });

  test('ftypボックスから始まっていない場合、falseを返す', () => {
    expect(looksLikeVideoContainer(Buffer.from('this is not an isobmff file at all'))).toBe(false);
  });

  test('バッファがメジャーブランドを読み取れないほど短い場合、falseを返す', () => {
    expect(looksLikeVideoContainer(Buffer.from([0x00, 0x00, 0x00, 0x14]))).toBe(false);
  });
});
