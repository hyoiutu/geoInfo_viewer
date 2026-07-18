import AdmZip from 'adm-zip';
import { describe, expect, test } from 'vitest';
import { extractTakeoutArchive } from '../takeout-archive.util';

/** テスト用のzipバッファを組み立てる（ディレクトリエントリを含めてadm-zipの実物で検証する） */
const buildZip = (entries: { path: string; content: string }[]): Buffer => {
  const zip = new AdmZip();
  zip.addFile('Google フォト/', Buffer.alloc(0));
  for (const entry of entries) {
    zip.addFile(entry.path, Buffer.from(entry.content));
  }
  return zip.toBuffer();
};

describe('extractTakeoutArchiveに関するテスト', () => {
  test('拡張子が.jsonのエントリはjsonEntriesへ、それ以外はphotoEntriesへ分類される', () => {
    const zipBuffer = buildZip([
      { path: 'Google フォト/2026-07/IMG_1234.jpg', content: 'binary-image-data' },
      { path: 'Google フォト/2026-07/IMG_1234.jpg.json', content: '{"title":"IMG_1234.jpg"}' }
    ]);

    const result = extractTakeoutArchive(zipBuffer);

    expect(result.photoEntries).toEqual([
      { path: 'Google フォト/2026-07/IMG_1234.jpg', data: Buffer.from('binary-image-data') }
    ]);
    expect(result.jsonEntries).toEqual([
      { path: 'Google フォト/2026-07/IMG_1234.jpg.json', data: Buffer.from('{"title":"IMG_1234.jpg"}') }
    ]);
  });

  test('ディレクトリエントリは結果に含まれない', () => {
    const zipBuffer = buildZip([{ path: 'Google フォト/2026-07/IMG_1234.jpg', content: 'binary-image-data' }]);

    const result = extractTakeoutArchive(zipBuffer);

    const allPaths = [...result.photoEntries, ...result.jsonEntries].map((entry) => entry.path);
    expect(allPaths).not.toContain('Google フォト/');
  });

  test('拡張子の大文字小文字を区別せず.JSONも.jsonと同様にjsonEntriesへ分類される', () => {
    const zipBuffer = buildZip([{ path: 'Google フォト/2026-07/IMG_1234.JSON', content: '{}' }]);

    const result = extractTakeoutArchive(zipBuffer);

    expect(result.jsonEntries).toHaveLength(1);
    expect(result.photoEntries).toHaveLength(0);
  });

  test('エントリが無い場合、両方とも空配列を返す', () => {
    const zip = new AdmZip();
    const zipBuffer = zip.toBuffer();

    const result = extractTakeoutArchive(zipBuffer);

    expect(result).toEqual({ photoEntries: [], jsonEntries: [] });
  });
});
