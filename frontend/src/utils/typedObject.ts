/**
 * Object.entriesの戻り値型（キーが常にstringへ広がる）を、元のRecordのキー型を保持したまま返す。
 * TypeScript本体の既知の制約でObject.entries自体の型を変えられないため、この関数内でのみキャストを行い、
 * 呼び出し側からキャストを追い出す（DRY: 同種のキャストをファイルごとに書き散らさない）
 * @param record 走査対象のRecord
 * @returns キーの型を保持した[key, value]の配列
 */
export const typedEntries = <K extends string, V>(record: Record<K, V>): [K, V][] =>
  // Object.entries()はキーを常にstringへ広げる仕様のためキャストが避けられない（TSDoc参照）
  Object.entries(record) as [K, V][];

/**
 * Object.fromEntriesの戻り値型（常に{ [k: string]: V }に広がる）を、指定したRecordの型として返す。
 * TypeScript本体の既知の制約でObject.fromEntries自体の型を変えられないため、この関数内でのみキャストを行う
 * @param entries [key, value]の配列
 * @returns キーの型を保持したRecord
 */
export const typedFromEntries = <K extends string, V>(entries: [K, V][]): Record<K, V> =>
  // Object.fromEntries()は常に{ [k: string]: V }を返す仕様のためキャストが避けられない（TSDoc参照）
  Object.fromEntries(entries) as Record<K, V>;
