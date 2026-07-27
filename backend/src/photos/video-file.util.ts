import { extname } from 'node:path';

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.avi', '.mkv', '.3gp', '.webm', '.m4v']);

/**
 * ファイル名の拡張子から、動画ファイルかどうかを判定する
 * @param fileName 対象ファイルのファイル名
 * @returns 動画ファイルの場合true
 */
export const isVideoFile = (fileName: string): boolean => VIDEO_EXTENSIONS.has(extname(fileName).toLowerCase());
