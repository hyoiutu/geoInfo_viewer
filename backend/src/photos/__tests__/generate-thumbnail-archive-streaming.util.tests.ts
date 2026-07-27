import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import AdmZip from 'adm-zip';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import yauzl from 'yauzl';
import { generateThumbnailArchiveStreaming, THUMBNAIL_WIDTH_PX } from '../generate-thumbnail-archive-streaming.util';
import { convertHeicBufferToJpegBuffer } from '../heic-conversion.util';

vi.mock('../heic-conversion.util', () => ({ convertHeicBufferToJpegBuffer: vi.fn() }));

const createTestImage = (
  widthPx: number,
  heightPx: number,
  color: { r: number; g: number; b: number }
): Promise<Buffer> => {
  return sharp({ create: { width: widthPx, height: heightPx, channels: 3, background: color } })
    .jpeg()
    .toBuffer();
};

// Android Motion PhotoのMP4部分先頭(ftypボックス)を模したバイト列
const createFakeMp4FtypBox = (): Buffer => {
  return Buffer.concat([Buffer.from([0x00, 0x00, 0x00, 0x18]), Buffer.from('ftypisom', 'ascii')]);
};

// 実際のHEIC/HEIFファイルが持つISOBMFFのftypボックス(先頭4バイトがボックスサイズ、続く4バイトが
// 'ftyp')を模した先頭バイト列。中身自体の正確なHEICデータではないため、実際のデコードには使えない
const createFakeHeicHeader = (): Buffer => {
  return Buffer.concat([Buffer.from([0x00, 0x00, 0x00, 0x18]), Buffer.from('ftypheic', 'ascii')]);
};

// 拡張子が失われたQuickTime動画(実データで見つかった事例)を模した先頭バイト列
const createFakeQuickTimeHeader = (): Buffer => {
  return Buffer.concat([Buffer.from([0x00, 0x00, 0x00, 0x14]), Buffer.from('ftypqt  ', 'ascii')]);
};

const writeFixtureZip = (dir: string, fileName: string, entries: Record<string, Buffer>): string => {
  const zip = new AdmZip();
  for (const [entryName, content] of Object.entries(entries)) {
    zip.addFile(entryName, content);
  }
  const filePath = join(dir, fileName);
  writeFileSync(filePath, zip.toBuffer());
  return filePath;
};

const readZipEntries = async (zipPath: string): Promise<{ fileName: string; content: Buffer }[]> => {
  return new Promise((resolve, reject) => {
    const results: { fileName: string; content: Buffer }[] = [];
    yauzl.open(zipPath, { lazyEntries: true }, (openError, zipFile) => {
      if (openError || !zipFile) {
        reject(openError ?? new Error('failed to open zip'));
        return;
      }
      zipFile.readEntry();
      zipFile.on('entry', (entry) => {
        zipFile.openReadStream(entry, (streamError, readStream) => {
          if (streamError || !readStream) {
            reject(streamError ?? new Error('failed to open read stream'));
            return;
          }
          const chunks: Buffer[] = [];
          readStream.on('data', (chunk: Buffer) => chunks.push(chunk));
          readStream.on('end', () => {
            results.push({ fileName: entry.fileName, content: Buffer.concat(chunks) });
            zipFile.readEntry();
          });
        });
      });
      zipFile.on('end', () => resolve(results));
      zipFile.on('error', reject);
    });
  });
};

describe('generateThumbnailArchiveStreamingに関するテスト', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'thumbnail-streaming-test-'));
    vi.mocked(convertHeicBufferToJpegBuffer).mockReset();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test('横600px・縦400pxの画像を、縦横比を維持したまま横300pxへリサイズする', async () => {
    const original = await createTestImage(600, 400, { r: 255, g: 0, b: 0 });
    const sourcePath = writeFixtureZip(dir, 'source.zip', { 'IMG_1.jpg': original });
    const destPath = join(dir, 'thumbnails.zip');

    const result = await generateThumbnailArchiveStreaming(sourcePath, destPath);

    expect(result.entries).toEqual([{ archivePath: 'IMG_1.jpg' }]);
    const entries = await readZipEntries(destPath);
    expect(entries).toHaveLength(1);
    const metadata = await sharp(entries[0].content).metadata();
    expect(metadata.width).toBe(THUMBNAIL_WIDTH_PX);
    expect(metadata.height).toBe(200);
  });

  test('複数エントリをそれぞれリサイズして出力する', async () => {
    const image1 = await createTestImage(900, 600, { r: 0, g: 255, b: 0 });
    const image2 = await createTestImage(300, 300, { r: 0, g: 0, b: 255 });
    const sourcePath = writeFixtureZip(dir, 'source.zip', { 'IMG_1.jpg': image1, 'IMG_2.jpg': image2 });
    const destPath = join(dir, 'thumbnails.zip');

    const result = await generateThumbnailArchiveStreaming(sourcePath, destPath);

    expect(result.entries.map((entry) => entry.archivePath).sort()).toEqual(['IMG_1.jpg', 'IMG_2.jpg']);
    expect(result.failedEntries).toEqual([]);
    const entries = await readZipEntries(destPath);
    expect(entries).toHaveLength(2);
    for (const entry of entries) {
      const metadata = await sharp(entry.content).metadata();
      expect(metadata.width).toBe(THUMBNAIL_WIDTH_PX);
    }
  });

  test('画像として不正なエントリが1件あっても、そのエントリだけをfailedEntriesへ記録し、他の正常なエントリの処理は継続する', async () => {
    const validImage = await createTestImage(600, 400, { r: 255, g: 0, b: 0 });
    const corruptImage = Buffer.from('this is not a valid image file');
    const sourcePath = writeFixtureZip(dir, 'source.zip', {
      'IMG_1.jpg': validImage,
      'IMG_broken.jpg': corruptImage
    });
    const destPath = join(dir, 'thumbnails.zip');

    const result = await generateThumbnailArchiveStreaming(sourcePath, destPath);

    expect(result.entries).toEqual([{ archivePath: 'IMG_1.jpg' }]);
    expect(result.failedEntries).toHaveLength(1);
    expect(result.failedEntries[0].archivePath).toBe('IMG_broken.jpg');
    const entries = await readZipEntries(destPath);
    expect(entries.map((entry) => entry.fileName)).toEqual(['IMG_1.jpg']);
  });

  test('Android Motion Photo(.mp)は、先頭のJPEG部分を抽出してからサムネイル化する', async () => {
    const jpeg = await createTestImage(600, 400, { r: 255, g: 0, b: 0 });
    const motionPhoto = Buffer.concat([jpeg, createFakeMp4FtypBox(), Buffer.from('dummy video bytes')]);
    const sourcePath = writeFixtureZip(dir, 'source.zip', { 'IMG_1.mp': motionPhoto });
    const destPath = join(dir, 'thumbnails.zip');

    const result = await generateThumbnailArchiveStreaming(sourcePath, destPath);

    expect(result.entries).toEqual([{ archivePath: 'IMG_1.mp' }]);
    expect(result.failedEntries).toEqual([]);
    const entries = await readZipEntries(destPath);
    const metadata = await sharp(entries[0].content).metadata();
    expect(metadata.width).toBe(THUMBNAIL_WIDTH_PX);
  });

  test('拡張子が.heic/.heifで中身も実際にISOBMFFのftypボックスから始まる場合、sharpへ直接渡す前にconvertHeicBufferToJpegBufferで変換したバッファを使う', async () => {
    const convertedJpeg = await createTestImage(600, 400, { r: 0, g: 255, b: 0 });
    vi.mocked(convertHeicBufferToJpegBuffer).mockReturnValue(convertedJpeg);
    const heicSource = Buffer.concat([createFakeHeicHeader(), Buffer.from('dummy heic payload')]);
    const sourcePath = writeFixtureZip(dir, 'source.zip', { 'IMG_1.heic': heicSource });
    const destPath = join(dir, 'thumbnails.zip');

    const result = await generateThumbnailArchiveStreaming(sourcePath, destPath);

    expect(convertHeicBufferToJpegBuffer).toHaveBeenCalledWith(heicSource);
    expect(result.entries).toEqual([{ archivePath: 'IMG_1.heic' }]);
    const entries = await readZipEntries(destPath);
    const metadata = await sharp(entries[0].content).metadata();
    expect(metadata.width).toBe(THUMBNAIL_WIDTH_PX);
  });

  test('HEIC/HEIFエントリの変換(convertHeicBufferToJpegBuffer)が失敗した場合、そのエントリだけをfailedEntriesへ記録する', async () => {
    vi.mocked(convertHeicBufferToJpegBuffer).mockImplementation(() => {
      throw new Error('heif-convert failed');
    });
    const heicSource = Buffer.concat([createFakeHeicHeader(), Buffer.from('dummy heic payload')]);
    const sourcePath = writeFixtureZip(dir, 'source.zip', { 'IMG_broken.heic': heicSource });
    const destPath = join(dir, 'thumbnails.zip');

    const result = await generateThumbnailArchiveStreaming(sourcePath, destPath);

    expect(result.entries).toEqual([]);
    expect(result.failedEntries).toEqual([{ archivePath: 'IMG_broken.heic', reason: 'heif-convert failed' }]);
  });

  test('拡張子が.heic/.heifでも、中身が実際にはISOBMFFのftypボックスから始まっていない(別形式)場合は、convertHeicBufferToJpegBufferを経由せず直接デコードする', async () => {
    const actuallyJpeg = await createTestImage(600, 400, { r: 255, g: 255, b: 0 });
    const sourcePath = writeFixtureZip(dir, 'source.zip', { 'IMG_1.HEIC': actuallyJpeg });
    const destPath = join(dir, 'thumbnails.zip');

    const result = await generateThumbnailArchiveStreaming(sourcePath, destPath);

    expect(convertHeicBufferToJpegBuffer).not.toHaveBeenCalled();
    expect(result.entries).toEqual([{ archivePath: 'IMG_1.HEIC' }]);
    const entries = await readZipEntries(destPath);
    const metadata = await sharp(entries[0].content).metadata();
    expect(metadata.width).toBe(THUMBNAIL_WIDTH_PX);
  });

  test('拡張子が写真の形式でも、中身が実際には動画(QuickTime等)の場合は動画として除外し、entries・failedEntriesのいずれにも含めない', async () => {
    const actuallyVideo = Buffer.concat([createFakeQuickTimeHeader(), Buffer.from('dummy quicktime payload')]);
    const validImage = await createTestImage(600, 400, { r: 255, g: 0, b: 0 });
    const sourcePath = writeFixtureZip(dir, 'source.zip', {
      videoWithoutExtension: actuallyVideo,
      'IMG_1.jpg': validImage
    });

    const destPath = join(dir, 'thumbnails.zip');

    const result = await generateThumbnailArchiveStreaming(sourcePath, destPath);

    expect(result.entries).toEqual([{ archivePath: 'IMG_1.jpg' }]);
    expect(result.failedEntries).toEqual([]);
    const entries = await readZipEntries(destPath);
    expect(entries.map((entry) => entry.fileName)).toEqual(['IMG_1.jpg']);
  });
});
