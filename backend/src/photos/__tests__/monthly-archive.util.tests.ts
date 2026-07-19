import AdmZip from 'adm-zip';
import { describe, expect, test } from 'vitest';
import { mergeMonthlyArchive } from '../monthly-archive.util';
import type { TakeoutArchiveEntry } from '../takeout-archive.util';
import type { PhotoMetadata } from '../takeout-metadata.util';

const createEntry = (path: string, content = path): TakeoutArchiveEntry => ({ path, data: Buffer.from(content) });
const metadata: PhotoMetadata = { takenAt: new Date('2026-07-01T00:00:00Z'), location: null };

describe('mergeMonthlyArchiveに関するテスト', () => {
  test('既存アーカイブが無い場合(null)、新規エントリのみを含むzipを作成する', () => {
    const photo = { entry: createEntry('album/IMG_1.jpg'), metadata };

    const result = mergeMonthlyArchive(null, [photo]);

    expect(result.entries).toEqual([{ photo, archivePath: 'IMG_1.jpg' }]);
    const zip = new AdmZip(result.zipBuffer);
    expect(zip.getEntries().map((e) => e.entryName)).toEqual(['IMG_1.jpg']);
    expect(zip.getEntry('IMG_1.jpg')?.getData().toString()).toBe('album/IMG_1.jpg');
  });

  test('既存アーカイブがある場合、既存エントリを保ったまま新規エントリを追記する', () => {
    const existingZip = new AdmZip();
    existingZip.addFile('existing.jpg', Buffer.from('existing-content'));
    const photo = { entry: createEntry('album/IMG_2.jpg'), metadata };

    const result = mergeMonthlyArchive(existingZip.toBuffer(), [photo]);

    const zip = new AdmZip(result.zipBuffer);
    expect(
      zip
        .getEntries()
        .map((e) => e.entryName)
        .sort()
    ).toEqual(['IMG_2.jpg', 'existing.jpg']);
    expect(zip.getEntry('existing.jpg')?.getData().toString()).toBe('existing-content');
  });

  test('既存アーカイブと同名のファイルを追加する場合、連番を付けて重複を避ける', () => {
    const existingZip = new AdmZip();
    existingZip.addFile('IMG_1.jpg', Buffer.from('original-content'));
    const photo = { entry: createEntry('album/IMG_1.jpg', 'new-content'), metadata };

    const result = mergeMonthlyArchive(existingZip.toBuffer(), [photo]);

    expect(result.entries).toEqual([{ photo, archivePath: 'IMG_1-2.jpg' }]);
    const zip = new AdmZip(result.zipBuffer);
    expect(
      zip
        .getEntries()
        .map((e) => e.entryName)
        .sort()
    ).toEqual(['IMG_1-2.jpg', 'IMG_1.jpg']);
    expect(zip.getEntry('IMG_1.jpg')?.getData().toString()).toBe('original-content');
    expect(zip.getEntry('IMG_1-2.jpg')?.getData().toString()).toBe('new-content');
  });

  test('新規エントリ同士でも同名の場合、それぞれ連番を付けて重複を避ける', () => {
    const photo1 = { entry: createEntry('a/IMG_1.jpg', 'content-1'), metadata };
    const photo2 = { entry: createEntry('b/IMG_1.jpg', 'content-2'), metadata };

    const result = mergeMonthlyArchive(null, [photo1, photo2]);

    expect(result.entries).toEqual([
      { photo: photo1, archivePath: 'IMG_1.jpg' },
      { photo: photo2, archivePath: 'IMG_1-2.jpg' }
    ]);
  });

  test('拡張子が無いファイル名でも連番を付けられる', () => {
    const existingZip = new AdmZip();
    existingZip.addFile('IMG_1', Buffer.from('original-content'));
    const photo = { entry: createEntry('album/IMG_1', 'new-content'), metadata };

    const result = mergeMonthlyArchive(existingZip.toBuffer(), [photo]);

    expect(result.entries).toEqual([{ photo, archivePath: 'IMG_1-2' }]);
  });

  test('新規エントリが空の場合、既存アーカイブをそのまま返す', () => {
    const existingZip = new AdmZip();
    existingZip.addFile('existing.jpg', Buffer.from('existing-content'));

    const result = mergeMonthlyArchive(existingZip.toBuffer(), []);

    expect(result.entries).toEqual([]);
    const zip = new AdmZip(result.zipBuffer);
    expect(zip.getEntries().map((e) => e.entryName)).toEqual(['existing.jpg']);
  });
});
