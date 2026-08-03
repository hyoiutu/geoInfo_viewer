import { closeSync, openSync, readSync } from 'node:fs';
import { isVideoFile, looksLikeVideoContainer } from './video-file.util';

// ftypボックスかどうか・メジャーブランドが何かの判定に必要な範囲（ftypボックスタイプ4バイト＋
// メジャーブランド4バイト、オフセット4〜12）のみを読めば十分なため、動画は数GB級になりうる
// ローカルファイルを`looksLikeVideoContainer`のためだけに全読み込みしないよう、先頭のこの範囲のみを読む
const CONTAINER_SNIFF_BYTE_LENGTH = 12;

/**
 * ローカルファイルの先頭`byteLength`バイトのみを読み込む
 * @param absolutePath 読み込み対象ファイルの絶対パス
 * @param byteLength 読み込むバイト数
 * @returns 読み込んだバイト列（ファイルサイズがbyteLength未満の場合はファイル全体）
 */
const readFilePrefixSync = (absolutePath: string, byteLength: number): Buffer => {
  const fileDescriptor = openSync(absolutePath, 'r');
  try {
    const buffer = Buffer.alloc(byteLength);
    const bytesRead = readSync(fileDescriptor, buffer, 0, byteLength, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    closeSync(fileDescriptor);
  }
};

/**
 * ローカルファイルが動画かどうかを判定する。拡張子（`isVideoFile`）で判定できない場合のみ、
 * 拡張子が失われた動画（iPhoneのLive Photoに付随するQuickTime動画等）を検出するため、
 * 先頭バイトのISOBMFFコンテナ判定（`looksLikeVideoContainer`）にフォールバックする。
 * 動画は数GB級になりうるため、フォールバック時もファイル全体ではなく先頭の一部のみを読み込む
 * （`strip-videos-and-generate-thumbnails-locally.ts`から使う、Issue #104）
 * @param absolutePath 判定対象ファイルの絶対パス
 * @param fileName 判定対象ファイルのファイル名（拡張子判定に使用）
 * @returns 動画と判定した場合true
 */
export const isLocalFileVideo = (absolutePath: string, fileName: string): boolean => {
  if (isVideoFile(fileName)) {
    return true;
  }
  return looksLikeVideoContainer(readFilePrefixSync(absolutePath, CONTAINER_SNIFF_BYTE_LENGTH));
};
