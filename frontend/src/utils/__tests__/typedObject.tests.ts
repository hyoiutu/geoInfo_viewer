import { describe, expect, test } from 'vitest';
import { typedEntries, typedFromEntries } from '../typedObject';

describe('typedEntriesに関するテスト', () => {
  test('Recordを[key, value]の配列に変換する', () => {
    const record: Record<'a' | 'b', number> = { a: 1, b: 2 };

    const entries = typedEntries(record);

    expect(entries).toEqual([
      ['a', 1],
      ['b', 2]
    ]);
  });
});

describe('typedFromEntriesに関するテスト', () => {
  test('[key, value]の配列をRecordに変換する', () => {
    const entries: ['a' | 'b', number][] = [
      ['a', 1],
      ['b', 2]
    ];

    const record = typedFromEntries(entries);

    expect(record).toEqual({ a: 1, b: 2 });
  });
});
