import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import AdmZip from 'adm-zip';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import yauzl from 'yauzl';
import { generateThumbnailArchiveStreaming, THUMBNAIL_WIDTH_PX } from '../generate-thumbnail-archive-streaming.util';

const createTestImage = (
  widthPx: number,
  heightPx: number,
  color: { r: number; g: number; b: number }
): Promise<Buffer> => {
  return sharp({ create: { width: widthPx, height: heightPx, channels: 3, background: color } })
    .jpeg()
    .toBuffer();
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
    const entries = await readZipEntries(destPath);
    expect(entries).toHaveLength(2);
    for (const entry of entries) {
      const metadata = await sharp(entry.content).metadata();
      expect(metadata.width).toBe(THUMBNAIL_WIDTH_PX);
    }
  });
});
