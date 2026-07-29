import { crc32, deflateRawSync } from 'node:zlib';
import { describe, expect, test } from 'vitest';
import {
  decompressAndVerifyEntry,
  LOCAL_FILE_HEADER_FIXED_LENGTH,
  parseLocalFileHeader,
  scanLocalFileHeaders
} from '../legacy-archive-recovery.util';

/** テスト用に、実際のZIPローカルファイルヘッダー1件分のバイト列(ヘッダー+ファイル名)を組み立てる */
const buildLocalFileHeaderEntry = (params: {
  fileName: string;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  crc32: number;
  generalPurposeFlag?: number;
}): Buffer => {
  const fileNameBuffer = Buffer.from(params.fileName, 'utf8');
  const header = Buffer.alloc(LOCAL_FILE_HEADER_FIXED_LENGTH);
  header.writeUInt32LE(0x04034b50, 0); // ローカルファイルヘッダーシグネチャ
  header.writeUInt16LE(20, 4); // version needed to extract
  header.writeUInt16LE(params.generalPurposeFlag ?? 0, 6);
  header.writeUInt16LE(params.compressionMethod, 8);
  header.writeUInt16LE(0, 10); // mod time
  header.writeUInt16LE(0, 12); // mod date
  header.writeUInt32LE(params.crc32, 14);
  header.writeUInt32LE(params.compressedSize, 18);
  header.writeUInt32LE(params.uncompressedSize, 22);
  header.writeUInt16LE(fileNameBuffer.length, 26);
  header.writeUInt16LE(0, 28); // extra field length
  return Buffer.concat([header, fileNameBuffer]);
};

describe('parseLocalFileHeaderに関するテスト', () => {
  test('正しいローカルファイルヘッダーを解析できる', () => {
    const entry = buildLocalFileHeaderEntry({
      fileName: 'IMG_1.jpg',
      compressionMethod: 8,
      compressedSize: 100,
      uncompressedSize: 200,
      crc32: 0x12345678
    });

    const parsed = parseLocalFileHeader(entry);

    expect(parsed).toEqual({
      compressionMethod: 8,
      crc32: 0x12345678,
      compressedSize: 100,
      uncompressedSize: 200,
      fileNameLength: 'IMG_1.jpg'.length,
      extraFieldLength: 0,
      usesDataDescriptor: false
    });
  });

  test('汎用フラグのbit3が立っている場合、usesDataDescriptor=trueを返す', () => {
    const entry = buildLocalFileHeaderEntry({
      fileName: 'IMG_1.jpg',
      compressionMethod: 8,
      compressedSize: 100,
      uncompressedSize: 200,
      crc32: 0x12345678,
      generalPurposeFlag: 0x08
    });

    const parsed = parseLocalFileHeader(entry);

    expect(parsed?.usesDataDescriptor).toBe(true);
  });

  test('シグネチャが一致しない場合はnullを返す', () => {
    const buffer = Buffer.alloc(LOCAL_FILE_HEADER_FIXED_LENGTH);

    const parsed = parseLocalFileHeader(buffer);

    expect(parsed).toBeNull();
  });

  test('バッファがヘッダー長に満たない場合はnullを返す', () => {
    const buffer = Buffer.alloc(10);

    const parsed = parseLocalFileHeader(buffer);

    expect(parsed).toBeNull();
  });
});

describe('scanLocalFileHeadersに関するテスト', () => {
  test('複数のローカルファイルヘッダーを連続して検出する', () => {
    const entry1 = buildLocalFileHeaderEntry({
      fileName: 'IMG_1.jpg',
      compressionMethod: 0,
      compressedSize: 5,
      uncompressedSize: 5,
      crc32: 111
    });
    const data1 = Buffer.from('AAAAA');
    const entry2 = buildLocalFileHeaderEntry({
      fileName: 'IMG_2.jpg',
      compressionMethod: 8,
      compressedSize: 3,
      uncompressedSize: 10,
      crc32: 222
    });
    const data2 = Buffer.from('BBB');
    const buffer = Buffer.concat([entry1, data1, entry2, data2]);

    const result = scanLocalFileHeaders((offset, length) => buffer.subarray(offset, offset + length), buffer.length);

    expect(result.stopReason).toBe('end-of-file');
    expect(result.entries).toEqual([
      {
        fileName: 'IMG_1.jpg',
        dataOffset: entry1.length,
        compressedSize: 5,
        uncompressedSize: 5,
        compressionMethod: 0,
        crc32: 111
      },
      {
        fileName: 'IMG_2.jpg',
        dataOffset: entry1.length + data1.length + entry2.length,
        compressedSize: 3,
        uncompressedSize: 10,
        compressionMethod: 8,
        crc32: 222
      }
    ]);
  });

  test('ローカルファイルヘッダー以外のバイト列(セントラルディレクトリ等)に到達すると、そこで走査を止める', () => {
    const entry1 = buildLocalFileHeaderEntry({
      fileName: 'IMG_1.jpg',
      compressionMethod: 0,
      compressedSize: 5,
      uncompressedSize: 5,
      crc32: 111
    });
    const data1 = Buffer.from('AAAAA');
    // セントラルディレクトリの先頭シグネチャ(0x02014b50)を模したバイト列
    // (ローカルファイルヘッダー分の長さ以上無いとscanLocalFileHeadersが読み取りを試みないため、
    // ヘッダー長分のダミーバイトで埋める)
    const centralDirectorySignature = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x01, 0x02]),
      Buffer.alloc(LOCAL_FILE_HEADER_FIXED_LENGTH)
    ]);
    const buffer = Buffer.concat([entry1, data1, centralDirectorySignature]);

    const result = scanLocalFileHeaders((offset, length) => buffer.subarray(offset, offset + length), buffer.length);

    expect(result.stopReason).toBe('signature-mismatch');
    expect(result.stoppedAtOffset).toBe(entry1.length + data1.length);
    expect(result.entries).toHaveLength(1);
  });

  test('データディスクリプタモードのエントリに遭遇すると、そのエントリより前までを返して走査を止める', () => {
    const entry1 = buildLocalFileHeaderEntry({
      fileName: 'IMG_1.jpg',
      compressionMethod: 0,
      compressedSize: 5,
      uncompressedSize: 5,
      crc32: 111
    });
    const data1 = Buffer.from('AAAAA');
    const entry2WithDataDescriptor = buildLocalFileHeaderEntry({
      fileName: 'IMG_2.jpg',
      compressionMethod: 8,
      compressedSize: 3,
      uncompressedSize: 10,
      crc32: 222,
      generalPurposeFlag: 0x08
    });
    const buffer = Buffer.concat([entry1, data1, entry2WithDataDescriptor]);

    const result = scanLocalFileHeaders((offset, length) => buffer.subarray(offset, offset + length), buffer.length);

    expect(result.stopReason).toBe('data-descriptor');
    expect(result.stoppedAtOffset).toBe(entry1.length + data1.length);
    expect(result.entries).toHaveLength(1);
  });

  test('空のバイト列の場合、エントリ0件でend-of-fileを返す', () => {
    const result = scanLocalFileHeaders(() => Buffer.alloc(0), 0);

    expect(result.entries).toEqual([]);
    expect(result.stopReason).toBe('end-of-file');
    expect(result.stoppedAtOffset).toBe(0);
  });
});

describe('decompressAndVerifyEntryに関するテスト', () => {
  test('STORED(無圧縮)エントリを検証し、そのままのデータを返す', () => {
    const originalData = Buffer.from('hello world');
    const entry = {
      fileName: 'IMG_1.jpg',
      dataOffset: 0,
      compressedSize: originalData.length,
      uncompressedSize: originalData.length,
      compressionMethod: 0,
      crc32: crc32(originalData)
    };

    const result = decompressAndVerifyEntry(originalData, entry);

    expect(result.equals(originalData)).toBe(true);
  });

  test('DEFLATEエントリを展開し、検証する', () => {
    const originalData = Buffer.from('hello world, this is compressed data for testing purposes');
    const compressed = deflateRawSync(originalData);
    const entry = {
      fileName: 'IMG_1.jpg',
      dataOffset: 0,
      compressedSize: compressed.length,
      uncompressedSize: originalData.length,
      compressionMethod: 8,
      crc32: crc32(originalData)
    };

    const result = decompressAndVerifyEntry(compressed, entry);

    expect(result.equals(originalData)).toBe(true);
  });

  test('展開後サイズが一致しない場合はエラーを投げる', () => {
    const originalData = Buffer.from('hello world');
    const entry = {
      fileName: 'IMG_1.jpg',
      dataOffset: 0,
      compressedSize: originalData.length,
      uncompressedSize: originalData.length + 1,
      compressionMethod: 0,
      crc32: crc32(originalData)
    };

    expect(() => decompressAndVerifyEntry(originalData, entry)).toThrow(/サイズが一致しません/);
  });

  test('CRC32が一致しない場合はエラーを投げる', () => {
    const originalData = Buffer.from('hello world');
    const entry = {
      fileName: 'IMG_1.jpg',
      dataOffset: 0,
      compressedSize: originalData.length,
      uncompressedSize: originalData.length,
      compressionMethod: 0,
      crc32: 0
    };

    expect(() => decompressAndVerifyEntry(originalData, entry)).toThrow(/CRC32が一致しません/);
  });
});
