import { extname } from 'node:path';

const DEFAULT_CONTENT_TYPE = 'application/octet-stream';

const IMAGE_CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.heic': 'image/heic',
  '.webp': 'image/webp'
};

/**
 * ファイル名の拡張子から、写真バイナリ配信時のHTTP Content-Typeを求める
 * @param fileName 対象の写真のファイル名
 * @returns 対応するContent-Type。未知の拡張子の場合は'application/octet-stream'
 */
export const resolveImageContentType = (fileName: string): string => {
  const extension = extname(fileName).toLowerCase();
  return IMAGE_CONTENT_TYPES[extension] ?? DEFAULT_CONTENT_TYPE;
};
