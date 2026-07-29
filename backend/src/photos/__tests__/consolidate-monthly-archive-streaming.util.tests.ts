import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import AdmZip from 'adm-zip';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import yauzl from 'yauzl';
import { consolidateArchiveFilesWithoutVideosStreaming } from '../consolidate-monthly-archive-streaming.util';

const writeFixtureZip = (dir: string, fileName: string, entries: Record<string, string>): string => {
  const zip = new AdmZip();
  for (const [entryName, content] of Object.entries(entries)) {
    zip.addFile(entryName, Buffer.from(content));
  }
  const filePath = join(dir, fileName);
  writeFileSync(filePath, zip.toBuffer());
  return filePath;
};

const readZipEntries = async (zipPath: string): Promise<{ fileName: string; method: number; content: string }[]> => {
  return new Promise((resolve, reject) => {
    const results: { fileName: string; method: number; content: string }[] = [];
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
            results.push({
              fileName: entry.fileName,
              method: entry.compressionMethod,
              content: Buffer.concat(chunks).toString()
            });
            zipFile.readEntry();
          });
        });
      });
      zipFile.on('end', () => resolve(results));
      zipFile.on('error', reject);
    });
  });
};

describe('consolidateArchiveFilesWithoutVideosStreamingに関するテスト', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'consolidate-streaming-test-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test('動画エントリを除外し、写真エントリのみを含む新規zipをディスク上に作成する', async () => {
    const sourcePath = writeFixtureZip(dir, 'source.zip', { 'IMG_1.jpg': 'photo-1', 'VID_1.mp4': 'video-1' });
    const destPath = join(dir, 'dest.zip');

    const result = await consolidateArchiveFilesWithoutVideosStreaming(
      [{ sourceFileId: 'file-1', filePath: sourcePath }],
      destPath
    );

    expect(result.keptEntries).toEqual([
      { sourceFileId: 'file-1', oldArchivePath: 'IMG_1.jpg', newArchivePath: 'IMG_1.jpg' }
    ]);
    expect(result.removedVideoEntries).toEqual([{ sourceFileId: 'file-1', archivePath: 'VID_1.mp4' }]);

    const entries = await readZipEntries(destPath);
    expect(entries.map((entry) => entry.fileName)).toEqual(['IMG_1.jpg']);
    expect(entries[0].content).toBe('photo-1');
  });

  test('複数の元アーカイブ由来で同名ファイルが衝突する場合、連番を付けて共存させる', async () => {
    const sourcePath1 = writeFixtureZip(dir, 'source1.zip', { 'IMG_1.jpg': 'photo-a' });
    const sourcePath2 = writeFixtureZip(dir, 'source2.zip', { 'IMG_1.jpg': 'photo-b' });
    const destPath = join(dir, 'dest.zip');

    const result = await consolidateArchiveFilesWithoutVideosStreaming(
      [
        { sourceFileId: 'file-1', filePath: sourcePath1 },
        { sourceFileId: 'file-2', filePath: sourcePath2 }
      ],
      destPath
    );

    expect(result.keptEntries).toEqual([
      { sourceFileId: 'file-1', oldArchivePath: 'IMG_1.jpg', newArchivePath: 'IMG_1.jpg' },
      { sourceFileId: 'file-2', oldArchivePath: 'IMG_1.jpg', newArchivePath: 'IMG_1-2.jpg' }
    ]);

    const entries = await readZipEntries(destPath);
    expect(entries.map((entry) => entry.fileName).sort()).toEqual(['IMG_1-2.jpg', 'IMG_1.jpg']);
  });

  test('新規エントリはSTORED（無圧縮）で追加する', async () => {
    const sourcePath = writeFixtureZip(dir, 'source.zip', { 'IMG_1.jpg': 'photo-1' });
    const destPath = join(dir, 'dest.zip');

    await consolidateArchiveFilesWithoutVideosStreaming([{ sourceFileId: 'file-1', filePath: sourcePath }], destPath);

    const entries = await readZipEntries(destPath);
    const zipCompressionMethodStored = 0;
    expect(entries[0].method).toBe(zipCompressionMethodStored);
  });

  test('動画のみの場合、エントリを含まない空のzipとremovedVideoEntriesのみを返す', async () => {
    const sourcePath = writeFixtureZip(dir, 'source.zip', { 'VID_1.mp4': 'video-1' });
    const destPath = join(dir, 'dest.zip');

    const result = await consolidateArchiveFilesWithoutVideosStreaming(
      [{ sourceFileId: 'file-1', filePath: sourcePath }],
      destPath
    );

    expect(result.keptEntries).toEqual([]);
    expect(result.removedVideoEntries).toEqual([{ sourceFileId: 'file-1', archivePath: 'VID_1.mp4' }]);
    const entries = await readZipEntries(destPath);
    expect(entries).toEqual([]);
  });
});
