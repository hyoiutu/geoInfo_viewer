import type { TakeoutArchiveEntry } from './takeout-archive.util';

const JSON_EXTENSION = '.json';

/** matchPhotosWithJsonSidecarsの戻り値1件分（写真とマッチしたJSONサイドカーの組） */
export type MatchedPhoto = {
  /** 写真本体のエントリ */
  photo: TakeoutArchiveEntry;
  /** マッチしたJSONサイドカーのエントリ。対応するJSONが見つからない場合はnull */
  json: TakeoutArchiveEntry | null;
};

/**
 * JSONサイドカーファイルのパスから、.json拡張子を除いたベース名を求める
 * @param jsonPath JSONサイドカーファイルのパス
 * @returns 拡張子を除いたベース名
 */
const stripJsonExtension = (jsonPath: string): string => jsonPath.slice(0, -JSON_EXTENSION.length);

/**
 * 写真のパスとJSON側のベース名が、どちらか一方が他方の前方一致になっているかを判定する。
 * 完全一致（`{写真名}.json`）・`.supplemental-metadata.json`形式・46文字制限による接尾辞の
 * 不規則な切り詰めのいずれのパターンも、この前方一致判定でカバーできる
 * @param photoPath 写真本体のパス
 * @param jsonBaseName JSONサイドカーの拡張子を除いたベース名
 * @returns 前方一致していればtrue
 */
const isPrefixMatch = (photoPath: string, jsonBaseName: string): boolean =>
  photoPath.startsWith(jsonBaseName) || jsonBaseName.startsWith(photoPath);

/**
 * 写真本体一覧とJSONサイドカー一覧を、ファイル名の緩やかな前方一致マッチングで紐付ける。
 * Google Takeoutのファイル名対応の罠（46文字制限による接尾辞の不規則な切り詰め、拡張子有無の
 * 不一致等）に対応するため、単純な完全一致ではなく前方一致で判定し、複数候補がある場合は
 * 最も長く一致するもの（＝最も情報量の多い一致）を選ぶ。対応するJSONが見つからない写真はjson: nullとなる
 * @param photoEntries 写真本体のエントリ一覧
 * @param jsonEntries JSONサイドカーのエントリ一覧
 * @returns 写真ごとのマッチ結果一覧
 */
export const matchPhotosWithJsonSidecars = (
  photoEntries: TakeoutArchiveEntry[],
  jsonEntries: TakeoutArchiveEntry[]
): MatchedPhoto[] => {
  const jsonCandidates = jsonEntries.map((json) => ({ json, baseName: stripJsonExtension(json.path) }));

  return photoEntries.map((photo) => {
    const matches = jsonCandidates.filter(({ baseName }) => isPrefixMatch(photo.path, baseName));
    if (matches.length === 0) {
      return { photo, json: null };
    }

    const best = matches.reduce((longest, candidate) =>
      candidate.baseName.length > longest.baseName.length ? candidate : longest
    );
    return { photo, json: best.json };
  });
};
