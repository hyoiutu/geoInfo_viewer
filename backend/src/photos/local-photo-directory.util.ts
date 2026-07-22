import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { TakeoutArchiveEntry } from './takeout-archive.util';

const JSON_EXTENSION = '.json';

/** ローカルディレクトリ内の1ファイル分（相対パス・絶対パスの組） */
export type LocalArchiveEntry = TakeoutArchiveEntry & {
  /** ファイルの絶対パス。写真本体の実バイナリを遅延読み込みする際に使う（readLocalPhotoData参照） */
  absolutePath: string;
};

/** scanLocalPhotoDirectoryの戻り値 */
export type ScannedLocalPhotoDirectory = {
  /** 写真本体のエントリ一覧。dataは未読み込みのプレースホルダ（空Buffer） */
  photoEntries: LocalArchiveEntry[];
  /** JSONサイドカーファイルのエントリ一覧。サイズが小さいためdataは読み込み済み */
  jsonEntries: LocalArchiveEntry[];
};

/**
 * ローカルディレクトリ（フラットな構成）を走査し、写真本体とJSONサイドカーファイルへ分類する。
 * サブディレクトリは対象外とする。写真本体のバイナリは巨大になりうる・全件を同時にメモリへ
 * 保持できないため即座には読み込まず、実際に必要になった時点でreadLocalPhotoDataから
 * absolutePathを使って読み込む（Issue #23 写真ローカルバックフィル）
 * @param directoryPath 走査対象のディレクトリパス
 * @returns 写真本体・JSONサイドカーへ分類済みのエントリ一覧
 */
export const scanLocalPhotoDirectory = (directoryPath: string): ScannedLocalPhotoDirectory => {
  const fileNames = readdirSync(directoryPath);
  const photoEntries: LocalArchiveEntry[] = [];
  const jsonEntries: LocalArchiveEntry[] = [];

  for (const fileName of fileNames) {
    const absolutePath = join(directoryPath, fileName);
    if (!statSync(absolutePath).isFile()) {
      continue;
    }

    if (fileName.toLowerCase().endsWith(JSON_EXTENSION)) {
      jsonEntries.push({ path: fileName, absolutePath, data: readFileSync(absolutePath) });
    } else {
      photoEntries.push({ path: fileName, absolutePath, data: Buffer.alloc(0) });
    }
  }

  return { photoEntries, jsonEntries };
};

/**
 * 写真本体の実バイナリを、絶対パスから遅延読み込みする。scanLocalPhotoDirectoryが返す
 * photoEntriesのdataはプレースホルダのため、実バイナリが必要な処理の直前でこれを使う
 * @param entry photoEntriesの1件
 * @returns 実バイナリを読み込んだTakeoutArchiveEntry
 */
export const readLocalPhotoData = (entry: LocalArchiveEntry): TakeoutArchiveEntry => ({
  path: entry.path,
  data: readFileSync(entry.absolutePath)
});

/**
 * 写真本体の実バイナリを、dataへ実際にアクセスされた時点まで遅延させて読み込むTakeoutArchiveEntryを作る。
 * JSONサイドカー優先でメタデータを解決する場合（`resolvePhotoMetadata`）、JSON側で解決できれば
 * 写真本体のdataには一切アクセスしないため、この関数を使えば無駄な読み込みを避けられる。
 * 数万件規模のディレクトリに対してreadLocalPhotoDataで全件を無条件に読み込むと、JSONで解決できる
 * 大多数の写真についても不要なディスクI/Oが発生し実行時間が大きく伸びることが判明したため追加した
 * （Issue #23 写真ローカルバックフィル）
 * @param entry photoEntriesの1件
 * @returns dataアクセス時に遅延読み込みするTakeoutArchiveEntry
 */
export const createLazyPhotoData = (entry: LocalArchiveEntry): TakeoutArchiveEntry => ({
  path: entry.path,
  get data() {
    return readFileSync(entry.absolutePath);
  }
});
