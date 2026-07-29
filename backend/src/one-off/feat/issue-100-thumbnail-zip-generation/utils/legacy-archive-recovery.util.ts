import { crc32, inflateRawSync } from 'node:zlib';

// ZIP形式のローカルファイルヘッダーは「4バイトのシグネチャ(0x04034b50) + 26バイトの固定フィールド」
// という構造を持つ。破損したzip(End of Central Directory欠落)からエントリを復旧するには、
// このローカルファイルヘッダーを先頭から順に辿ればよい(セントラルディレクトリが無くても
// 各エントリの位置・サイズ自体はローカルファイルヘッダーに残っているため)
const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
export const LOCAL_FILE_HEADER_FIXED_LENGTH = 30;
const DEFLATE_COMPRESSION_METHOD = 8;
// 汎用フラグのbit3(0x08)は、書き込み時点でサイズが未確定のままデータを先に書き始め、
// 実際のサイズ・CRCを後続の「データディスクリプタ」で補う「ストリーミング」モードを示す。
// このモードではローカルファイルヘッダーのサイズフィールドが信頼できず、次のヘッダー位置へ
// 直接ジャンプできない
const DATA_DESCRIPTOR_FLAG_BIT = 0x08;

/** parseLocalFileHeaderの戻り値。ローカルファイルヘッダー1件分を解析した結果 */
export type ParsedLocalFileHeader = {
  /** 圧縮方式(0=STORED、8=DEFLATE等) */
  compressionMethod: number;
  /** 展開後データのCRC32チェックサム */
  crc32: number;
  /** 圧縮後のデータサイズ(バイト) */
  compressedSize: number;
  /** 展開後のデータサイズ(バイト) */
  uncompressedSize: number;
  /** ファイル名のバイト長 */
  fileNameLength: number;
  /** 拡張フィールドのバイト長 */
  extraFieldLength: number;
  /** サイズ未確定のまま書き込む「データディスクリプタ」モードかどうか */
  usesDataDescriptor: boolean;
};

/**
 * ローカルファイルヘッダー固定長部分(30バイト)を解析する
 * @param headerBuffer 解析対象のバッファ(30バイト以上、先頭30バイトのみ使用)
 * @returns 解析結果。シグネチャが一致しない場合はnull(ローカルファイルヘッダーではない)
 */
export const parseLocalFileHeader = (headerBuffer: Buffer): ParsedLocalFileHeader | null => {
  if (headerBuffer.length < LOCAL_FILE_HEADER_FIXED_LENGTH) {
    return null;
  }
  if (headerBuffer.readUInt32LE(0) !== LOCAL_FILE_HEADER_SIGNATURE) {
    return null;
  }
  const generalPurposeFlag = headerBuffer.readUInt16LE(6);
  return {
    compressionMethod: headerBuffer.readUInt16LE(8),
    crc32: headerBuffer.readUInt32LE(14),
    compressedSize: headerBuffer.readUInt32LE(18),
    uncompressedSize: headerBuffer.readUInt32LE(22),
    fileNameLength: headerBuffer.readUInt16LE(26),
    extraFieldLength: headerBuffer.readUInt16LE(28),
    usesDataDescriptor: (generalPurposeFlag & DATA_DESCRIPTOR_FLAG_BIT) !== 0
  };
};

/** scanLocalFileHeadersが検出した1エントリ分の情報 */
export type RecoveredZipEntry = {
  /** アーカイブ内でのファイル名 */
  fileName: string;
  /** 圧縮後データの開始位置(バイトオフセット) */
  dataOffset: number;
  /** 圧縮後のデータサイズ(バイト) */
  compressedSize: number;
  /** 展開後のデータサイズ(バイト) */
  uncompressedSize: number;
  /** 圧縮方式(0=STORED、8=DEFLATE等) */
  compressionMethod: number;
  /** 展開後データのCRC32チェックサム */
  crc32: number;
};

/** scanLocalFileHeadersがエントリ走査を止めた理由 */
export type ScanStopReason =
  /** ローカルファイルヘッダーのシグネチャと一致しないバイト列に到達した(セントラルディレクトリ等) */
  | 'signature-mismatch'
  /** ファイル末尾に到達した */
  | 'end-of-file'
  /** データディスクリプタモードのエントリに遭遇し、後続の位置を特定できなくなった */
  | 'data-descriptor';

/** scanLocalFileHeadersの戻り値 */
export type ScanLocalFileHeadersResult = {
  /** 検出したエントリの一覧(先頭から連続して読み取れた範囲) */
  entries: RecoveredZipEntry[];
  /** 走査を止めた理由 */
  stopReason: ScanStopReason;
  /** 走査を止めた時点のバイトオフセット */
  stoppedAtOffset: number;
};

/**
 * 指定範囲のバイト列を読み取る関数。ファイルディスクリプタ経由(実運用)・
 * インメモリBuffer経由(テスト)のいずれからでも同じロジックで走査できるよう抽象化している
 * @param offset 読み取り開始位置
 * @param length 読み取るバイト数
 * @returns 読み取ったバイト列。要求したlengthに満たない場合は読み取れた分のみを返す
 */
export type ByteRangeReader = (offset: number, length: number) => Buffer;

/**
 * バイト列の先頭からローカルファイルヘッダーを順に辿り、エントリを検出する。
 * 各エントリの圧縮後サイズフィールドを使って次のヘッダー位置へ直接ジャンプするため、
 * エントリのデータ本体自体は読み取らず高速に走査できる。End of Central Directoryが
 * 欠落・破損したzipファイルからエントリを復旧するために使う
 * @param read 指定範囲のバイト列を読み取る関数
 * @param totalSize 走査対象の総バイト数
 * @returns 検出したエントリの一覧と、走査を止めた理由・位置
 */
export const scanLocalFileHeaders = (read: ByteRangeReader, totalSize: number): ScanLocalFileHeadersResult => {
  const entries: RecoveredZipEntry[] = [];
  let offset = 0;

  while (offset + LOCAL_FILE_HEADER_FIXED_LENGTH <= totalSize) {
    const headerBuffer = read(offset, LOCAL_FILE_HEADER_FIXED_LENGTH);
    const parsed = parseLocalFileHeader(headerBuffer);
    if (parsed === null) {
      return { entries, stopReason: 'signature-mismatch', stoppedAtOffset: offset };
    }
    if (parsed.usesDataDescriptor) {
      return { entries, stopReason: 'data-descriptor', stoppedAtOffset: offset };
    }

    const fileNameBuffer = read(offset + LOCAL_FILE_HEADER_FIXED_LENGTH, parsed.fileNameLength);
    const fileName = fileNameBuffer.toString('utf8');
    const dataOffset = offset + LOCAL_FILE_HEADER_FIXED_LENGTH + parsed.fileNameLength + parsed.extraFieldLength;

    entries.push({
      fileName,
      dataOffset,
      compressedSize: parsed.compressedSize,
      uncompressedSize: parsed.uncompressedSize,
      compressionMethod: parsed.compressionMethod,
      crc32: parsed.crc32
    });

    offset = dataOffset + parsed.compressedSize;
  }

  return { entries, stopReason: 'end-of-file', stoppedAtOffset: offset };
};

/**
 * エントリの圧縮後データを展開し、宣言されているサイズ・CRC32と一致するか検証する
 * @param compressedData 圧縮後のデータ(scanLocalFileHeadersが返したdataOffset・compressedSizeの範囲)
 * @param entry 対応するエントリ情報(展開後サイズ・CRC32・圧縮方式)
 * @returns 展開後のデータ
 * @throws 展開後のサイズまたはCRC32が一致しない場合(データが破損している場合)
 */
export const decompressAndVerifyEntry = (compressedData: Buffer, entry: RecoveredZipEntry): Buffer => {
  const decompressed =
    entry.compressionMethod === DEFLATE_COMPRESSION_METHOD ? inflateRawSync(compressedData) : compressedData;

  if (decompressed.length !== entry.uncompressedSize) {
    throw new Error(
      `${entry.fileName}: 展開後サイズが一致しません(期待値=${entry.uncompressedSize}, 実際=${decompressed.length})`
    );
  }
  const actualCrc32 = crc32(decompressed);
  if (actualCrc32 !== entry.crc32) {
    throw new Error(`${entry.fileName}: CRC32が一致しません(期待値=${entry.crc32}, 実際=${actualCrc32})`);
  }
  return decompressed;
};
