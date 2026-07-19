import AdmZip from 'adm-zip';

const JSON_EXTENSION = '.json';

/** zip内の1エントリ分（パスと中身） */
export type TakeoutArchiveEntry = {
  /** zip内でのエントリパス */
  path: string;
  /** エントリの中身（バイナリ） */
  data: Buffer;
};

/** extractTakeoutArchiveの戻り値 */
export type ExtractedTakeoutArchive = {
  /** 写真本体のエントリ一覧 */
  photoEntries: TakeoutArchiveEntry[];
  /** JSONサイドカーファイルのエントリ一覧 */
  jsonEntries: TakeoutArchiveEntry[];
};

/**
 * Google TakeoutのzipバッファをAdmZipで読み込み、写真本体とJSONサイドカーファイルへ分類する。
 * ディレクトリエントリは結果に含めない
 * @param zipBuffer Google Takeoutのzipファイル本体
 * @returns 写真本体・JSONサイドカーへ分類済みのエントリ一覧
 */
export const extractTakeoutArchive = (zipBuffer: Buffer): ExtractedTakeoutArchive => {
  const zip = new AdmZip(zipBuffer);
  const photoEntries: TakeoutArchiveEntry[] = [];
  const jsonEntries: TakeoutArchiveEntry[] = [];

  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) {
      continue;
    }

    const archiveEntry: TakeoutArchiveEntry = { path: entry.entryName, data: entry.getData() };
    if (entry.entryName.toLowerCase().endsWith(JSON_EXTENSION)) {
      jsonEntries.push(archiveEntry);
    } else {
      photoEntries.push(archiveEntry);
    }
  }

  return { photoEntries, jsonEntries };
};
