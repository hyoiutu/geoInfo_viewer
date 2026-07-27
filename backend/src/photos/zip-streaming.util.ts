import { createWriteStream } from 'node:fs';
import yauzl from 'yauzl';
import type yazl from 'yazl';

/**
 * yauzlでzipエントリを1件ずつ開き、Readableストリームとして返す（Promise化）
 */
export const openEntryReadStream = (zipFile: yauzl.ZipFile, entry: yauzl.Entry): Promise<NodeJS.ReadableStream> => {
  return new Promise((resolve, reject) => {
    zipFile.openReadStream(entry, (error, readStream) => {
      if (error || !readStream) {
        reject(error ?? new Error(`failed to open read stream for entry: ${entry.fileName}`));
        return;
      }
      resolve(readStream);
    });
  });
};

/**
 * 指定したzipファイルパスを開き、エントリを1件ずつ処理する。yauzlの`lazyEntries`により
 * 次のエントリはコールバック側で明示的に`readEntry()`を呼ぶまで読み進めない。
 * `onEntry`は、そのエントリの後続処理（書き込み先への転送等）が完全に完了してから
 * resolveすること。yauzlは同一zipFileに対して複数エントリを同時並行で読み進める前提の
 * 実装になっていないため、前エントリの処理完了を待たずに次のreadEntry()を呼ぶと
 * 読み込み内容が壊れる恐れがある。動画削除・part統合（Issue #99）とサムネイル生成
 * （Issue #100）の両方で、ディスク上のzipをエントリ単位でストリーミング処理するために使う
 */
export const forEachZipEntry = (
  zipPath: string,
  onEntry: (zipFile: yauzl.ZipFile, entry: yauzl.Entry) => Promise<void>
): Promise<void> => {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (openError, zipFile) => {
      if (openError || !zipFile) {
        reject(openError ?? new Error(`failed to open zip: ${zipPath}`));
        return;
      }

      zipFile.readEntry();
      zipFile.on('entry', (entry) => {
        onEntry(zipFile, entry)
          .then(() => zipFile.readEntry())
          .catch(reject);
      });
      zipFile.on('end', resolve);
      zipFile.on('error', reject);
    });
  });
};

/**
 * yazlの出力を指定パスへ書き出すストリームを開始し、完了を待つPromiseを返す
 */
export const writeYazlOutput = (zipFile: yazl.ZipFile, destZipPath: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const writeStream = createWriteStream(destZipPath);
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
    zipFile.outputStream.pipe(writeStream);
  });
};

/**
 * 1件分のReadableストリームを最後まで読み切り、Bufferとして返す
 * @param stream 読み切る対象のストリーム
 * @returns 読み切ったバイト列
 */
export const readStreamToBuffer = (stream: NodeJS.ReadableStream): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
};
