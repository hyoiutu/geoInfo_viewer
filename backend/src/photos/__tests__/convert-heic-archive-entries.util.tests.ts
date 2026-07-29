import AdmZip from 'adm-zip';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { convertHeicArchiveEntries } from '../convert-heic-archive-entries.util';
import { convertHeicBufferToJpegBuffer } from '../heic-conversion.util';

vi.mock('../heic-conversion.util', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../heic-conversion.util')>()),
  convertHeicBufferToJpegBuffer: vi.fn()
}));

const createFakeHeicHeader = (): Buffer =>
  Buffer.concat([Buffer.from([0x00, 0x00, 0x00, 0x18]), Buffer.from('ftypheic', 'ascii')]);

const buildZip = (entries: { path: string; content: Buffer }[]): Buffer => {
  const zip = new AdmZip();
  for (const entry of entries) {
    zip.addFile(entry.path, entry.content);
  }
  return zip.toBuffer();
};

describe('convertHeicArchiveEntriesに関するテスト（Issue #106）', () => {
  beforeEach(() => {
    vi.mocked(convertHeicBufferToJpegBuffer).mockReset();
  });

  test('対象パスが実際にHEICの場合、JPEGへ変換し.jpg拡張子のエントリへ置き換える', () => {
    const heicBuffer = Buffer.concat([createFakeHeicHeader(), Buffer.from('heic-payload')]);
    const zipBuffer = buildZip([{ path: 'IMG_1.heic', content: heicBuffer }]);
    const jpegBuffer = Buffer.from('converted-jpeg-data');
    vi.mocked(convertHeicBufferToJpegBuffer).mockReturnValue(jpegBuffer);

    const result = convertHeicArchiveEntries(zipBuffer, ['IMG_1.heic']);

    expect(convertHeicBufferToJpegBuffer).toHaveBeenCalledWith(heicBuffer);
    expect(result.converted).toEqual([{ originalArchivePath: 'IMG_1.heic', archivePath: 'IMG_1.jpg' }]);
    expect(result.failed).toEqual([]);
    const zip = new AdmZip(result.zipBuffer);
    expect(zip.getEntries().map((entry) => entry.entryName)).toEqual(['IMG_1.jpg']);
    expect(zip.getEntry('IMG_1.jpg')?.getData()).toEqual(jpegBuffer);
  });

  test('変換後のエントリはSTORED（無圧縮）で追加する', () => {
    const heicBuffer = Buffer.concat([createFakeHeicHeader(), Buffer.from('heic-payload')]);
    const zipBuffer = buildZip([{ path: 'IMG_1.heic', content: heicBuffer }]);
    vi.mocked(convertHeicBufferToJpegBuffer).mockReturnValue(Buffer.from('converted-jpeg-data'));

    const result = convertHeicArchiveEntries(zipBuffer, ['IMG_1.heic']);

    const zip = new AdmZip(result.zipBuffer);
    const zipCompressionMethodStored = 0;
    expect(zip.getEntry('IMG_1.jpg')?.header.method).toBe(zipCompressionMethodStored);
  });

  test('変換後の名前が既存エントリと衝突する場合、連番を付けて重複を避ける', () => {
    const heicBuffer = Buffer.concat([createFakeHeicHeader(), Buffer.from('heic-payload')]);
    const zipBuffer = buildZip([
      { path: 'IMG_1.heic', content: heicBuffer },
      { path: 'IMG_1.jpg', content: Buffer.from('existing-jpeg') }
    ]);
    vi.mocked(convertHeicBufferToJpegBuffer).mockReturnValue(Buffer.from('converted-jpeg-data'));

    const result = convertHeicArchiveEntries(zipBuffer, ['IMG_1.heic']);

    expect(result.converted).toEqual([{ originalArchivePath: 'IMG_1.heic', archivePath: 'IMG_1-2.jpg' }]);
    const zip = new AdmZip(result.zipBuffer);
    expect(
      zip
        .getEntries()
        .map((entry) => entry.entryName)
        .sort()
    ).toEqual(['IMG_1-2.jpg', 'IMG_1.jpg']);
    expect(zip.getEntry('IMG_1.jpg')?.getData().toString()).toBe('existing-jpeg');
  });

  test('拡張子が.heicでも中身が実際にはHEICでない場合、変換せずそのままのエントリとして残す', () => {
    const notActuallyHeic = Buffer.from('this is actually a jpeg after re-save');
    const zipBuffer = buildZip([{ path: 'IMG_1.heic', content: notActuallyHeic }]);

    const result = convertHeicArchiveEntries(zipBuffer, ['IMG_1.heic']);

    expect(convertHeicBufferToJpegBuffer).not.toHaveBeenCalled();
    expect(result.converted).toEqual([]);
    expect(result.failed).toEqual([]);
    const zip = new AdmZip(result.zipBuffer);
    expect(zip.getEntries().map((entry) => entry.entryName)).toEqual(['IMG_1.heic']);
  });

  test('HEIC変換に失敗した場合、そのエントリは元のまま残し、failedへ理由とともに記録する。他の対象エントリの変換は継続する', () => {
    const heicBuffer1 = Buffer.concat([createFakeHeicHeader(), Buffer.from('heic-payload-1')]);
    const heicBuffer2 = Buffer.concat([createFakeHeicHeader(), Buffer.from('heic-payload-2')]);
    const zipBuffer = buildZip([
      { path: 'IMG_1.heic', content: heicBuffer1 },
      { path: 'IMG_2.heic', content: heicBuffer2 }
    ]);
    vi.mocked(convertHeicBufferToJpegBuffer).mockImplementation((buffer: Buffer) => {
      if (buffer.equals(heicBuffer1)) {
        throw new Error('heif-convert failed');
      }
      return Buffer.from('converted-jpeg-data-2');
    });

    const result = convertHeicArchiveEntries(zipBuffer, ['IMG_1.heic', 'IMG_2.heic']);

    expect(result.failed).toEqual([{ archivePath: 'IMG_1.heic', reason: 'heif-convert failed' }]);
    expect(result.converted).toEqual([{ originalArchivePath: 'IMG_2.heic', archivePath: 'IMG_2.jpg' }]);
    const zip = new AdmZip(result.zipBuffer);
    expect(
      zip
        .getEntries()
        .map((entry) => entry.entryName)
        .sort()
    ).toEqual(['IMG_1.heic', 'IMG_2.jpg']);
  });

  test('対象パスがzip内に存在しない場合、無視する', () => {
    const zipBuffer = buildZip([{ path: 'IMG_1.jpg', content: Buffer.from('jpeg-data') }]);

    const result = convertHeicArchiveEntries(zipBuffer, ['MISSING.heic']);

    expect(result.converted).toEqual([]);
    expect(result.failed).toEqual([]);
  });
});
