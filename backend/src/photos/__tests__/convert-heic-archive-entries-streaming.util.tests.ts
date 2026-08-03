import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import AdmZip from 'adm-zip';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import yauzl from 'yauzl';
import { convertHeicArchiveEntriesStreaming } from '../convert-heic-archive-entries-streaming.util';
import { convertHeicBufferToJpegBuffer } from '../heic-conversion.util';

vi.mock('../heic-conversion.util', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../heic-conversion.util')>()),
  convertHeicBufferToJpegBuffer: vi.fn()
}));

// 実際のHEIC/HEIFファイルが持つISOBMFFのftypボックス(先頭4バイトがボックスサイズ、続く4バイトが
// 'ftyp')を模した先頭バイト列。中身自体の正確なHEICデータではないため、実際のデコードには使えない
const createFakeHeicHeader = (): Buffer =>
  Buffer.concat([Buffer.from([0x00, 0x00, 0x00, 0x18]), Buffer.from('ftypheic', 'ascii')]);

const writeFixtureZip = (dir: string, fileName: string, entries: [string, Buffer][]): string => {
  const zip = new AdmZip();
  for (const [entryName, content] of entries) {
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

describe('convertHeicArchiveEntriesStreamingに関するテスト（PR #116レビュー対応。ディスク上のzipをストリーミングで処理し、アーカイブ全体を同時にメモリへ保持しない）', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'convert-heic-streaming-test-'));
    vi.mocked(convertHeicBufferToJpegBuffer).mockReset();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test('対象パスが実際にHEICの場合、JPEGへ変換し.jpg拡張子のエントリへ置き換える', async () => {
    const heicBuffer = Buffer.concat([createFakeHeicHeader(), Buffer.from('heic-payload')]);
    const sourcePath = writeFixtureZip(dir, 'source.zip', [['IMG_1.heic', heicBuffer]]);
    const destPath = join(dir, 'converted.zip');
    const jpegBuffer = Buffer.from('converted-jpeg-data');
    vi.mocked(convertHeicBufferToJpegBuffer).mockReturnValue(jpegBuffer);

    const result = await convertHeicArchiveEntriesStreaming(sourcePath, destPath, ['IMG_1.heic']);

    expect(convertHeicBufferToJpegBuffer).toHaveBeenCalledWith(heicBuffer);
    expect(result.converted).toEqual([{ originalArchivePath: 'IMG_1.heic', archivePath: 'IMG_1.jpg' }]);
    expect(result.failed).toEqual([]);
    const entries = await readZipEntries(destPath);
    expect(entries).toEqual([{ fileName: 'IMG_1.jpg', content: jpegBuffer }]);
  });

  test('変換対象外(targetArchivePathsに含まれない)のエントリは、中身に関わらず変換せずそのまま出力する', async () => {
    const heicBuffer = Buffer.concat([createFakeHeicHeader(), Buffer.from('heic-payload')]);
    const sourcePath = writeFixtureZip(dir, 'source.zip', [['IMG_1.heic', heicBuffer]]);
    const destPath = join(dir, 'converted.zip');

    const result = await convertHeicArchiveEntriesStreaming(sourcePath, destPath, []);

    expect(convertHeicBufferToJpegBuffer).not.toHaveBeenCalled();
    expect(result.converted).toEqual([]);
    expect(result.failed).toEqual([]);
    const entries = await readZipEntries(destPath);
    expect(entries).toEqual([{ fileName: 'IMG_1.heic', content: heicBuffer }]);
  });

  test('変換後の名前が既存エントリと衝突する場合、連番を付けて重複を避ける。衝突相手のエントリがzip内で変換対象より後にあっても正しく検出する', async () => {
    const heicBuffer = Buffer.concat([createFakeHeicHeader(), Buffer.from('heic-payload')]);
    const existingJpeg = Buffer.from('existing-jpeg');
    // IMG_1.jpgは変換対象のIMG_1.heicより後のエントリとして配置する。事前に全エントリ名を
    // 収集してから変換する実装でなければ、この順序では衝突を見逃してしまう
    const sourcePath = writeFixtureZip(dir, 'source.zip', [
      ['IMG_1.heic', heicBuffer],
      ['IMG_1.jpg', existingJpeg]
    ]);
    const destPath = join(dir, 'converted.zip');
    vi.mocked(convertHeicBufferToJpegBuffer).mockReturnValue(Buffer.from('converted-jpeg-data'));

    const result = await convertHeicArchiveEntriesStreaming(sourcePath, destPath, ['IMG_1.heic']);

    expect(result.converted).toEqual([{ originalArchivePath: 'IMG_1.heic', archivePath: 'IMG_1-2.jpg' }]);
    const entries = await readZipEntries(destPath);
    expect(entries.map((entry) => entry.fileName).sort()).toEqual(['IMG_1-2.jpg', 'IMG_1.jpg']);
    const originalJpegEntry = entries.find((entry) => entry.fileName === 'IMG_1.jpg');
    expect(originalJpegEntry?.content).toEqual(existingJpeg);
  });

  test('拡張子が.heicでも中身が実際にはHEICでない場合、変換せずそのままのエントリとして残す', async () => {
    const notActuallyHeic = Buffer.from('this is actually a jpeg after re-save');
    const sourcePath = writeFixtureZip(dir, 'source.zip', [['IMG_1.heic', notActuallyHeic]]);
    const destPath = join(dir, 'converted.zip');

    const result = await convertHeicArchiveEntriesStreaming(sourcePath, destPath, ['IMG_1.heic']);

    expect(convertHeicBufferToJpegBuffer).not.toHaveBeenCalled();
    expect(result.converted).toEqual([]);
    expect(result.failed).toEqual([]);
    const entries = await readZipEntries(destPath);
    expect(entries).toEqual([{ fileName: 'IMG_1.heic', content: notActuallyHeic }]);
  });

  test('HEIC変換に失敗した場合、そのエントリは元のまま残し、failedへ理由とともに記録する。他の対象エントリの変換は継続する', async () => {
    const heicBuffer1 = Buffer.concat([createFakeHeicHeader(), Buffer.from('heic-payload-1')]);
    const heicBuffer2 = Buffer.concat([createFakeHeicHeader(), Buffer.from('heic-payload-2')]);
    const sourcePath = writeFixtureZip(dir, 'source.zip', [
      ['IMG_1.heic', heicBuffer1],
      ['IMG_2.heic', heicBuffer2]
    ]);
    const destPath = join(dir, 'converted.zip');
    const jpegBuffer2 = Buffer.from('converted-jpeg-data-2');
    vi.mocked(convertHeicBufferToJpegBuffer).mockImplementation((buffer: Buffer) => {
      if (buffer.equals(heicBuffer1)) {
        throw new Error('heif-convert failed');
      }
      return jpegBuffer2;
    });

    const result = await convertHeicArchiveEntriesStreaming(sourcePath, destPath, ['IMG_1.heic', 'IMG_2.heic']);

    expect(result.failed).toEqual([{ archivePath: 'IMG_1.heic', reason: 'heif-convert failed' }]);
    expect(result.converted).toEqual([{ originalArchivePath: 'IMG_2.heic', archivePath: 'IMG_2.jpg' }]);
    const entries = await readZipEntries(destPath);
    expect(entries.map((entry) => entry.fileName).sort()).toEqual(['IMG_1.heic', 'IMG_2.jpg']);
    const failedEntry = entries.find((entry) => entry.fileName === 'IMG_1.heic');
    expect(failedEntry?.content).toEqual(heicBuffer1);
  });
});
