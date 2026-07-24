import AdmZip from 'adm-zip';
import { describe, expect, test } from 'vitest';
import { consolidateArchiveWithoutVideos } from '../consolidate-monthly-archive.util';

describe('consolidateArchiveWithoutVideosに関するテスト', () => {
  test('動画エントリを除外し、写真エントリのみを含む新規zipを作成する', () => {
    const entries = [
      { sourceFileId: 'file-1', archivePath: 'IMG_1.jpg', data: Buffer.from('photo-1') },
      { sourceFileId: 'file-1', archivePath: 'VID_1.mp4', data: Buffer.from('video-1') }
    ];

    const result = consolidateArchiveWithoutVideos(entries);

    expect(result.keptEntries).toEqual([
      { sourceFileId: 'file-1', oldArchivePath: 'IMG_1.jpg', newArchivePath: 'IMG_1.jpg' }
    ]);
    expect(result.removedVideoEntries).toEqual([{ sourceFileId: 'file-1', archivePath: 'VID_1.mp4' }]);
    const zip = new AdmZip(result.zipBuffer);
    expect(zip.getEntries().map((entry) => entry.entryName)).toEqual(['IMG_1.jpg']);
    expect(zip.getEntry('IMG_1.jpg')?.getData().toString()).toBe('photo-1');
  });

  test('複数の元アーカイブ由来で同名ファイルが衝突する場合、連番を付けて共存させる', () => {
    const entries = [
      { sourceFileId: 'file-1', archivePath: 'IMG_1.jpg', data: Buffer.from('photo-a') },
      { sourceFileId: 'file-2', archivePath: 'IMG_1.jpg', data: Buffer.from('photo-b') }
    ];

    const result = consolidateArchiveWithoutVideos(entries);

    expect(result.keptEntries).toEqual([
      { sourceFileId: 'file-1', oldArchivePath: 'IMG_1.jpg', newArchivePath: 'IMG_1.jpg' },
      { sourceFileId: 'file-2', oldArchivePath: 'IMG_1.jpg', newArchivePath: 'IMG_1-2.jpg' }
    ]);
  });

  test('新規エントリはSTORED（無圧縮）で追加する', () => {
    const entries = [{ sourceFileId: 'file-1', archivePath: 'IMG_1.jpg', data: Buffer.from('photo-1') }];

    const result = consolidateArchiveWithoutVideos(entries);

    const zip = new AdmZip(result.zipBuffer);
    const zipCompressionMethodStored = 0;
    expect(zip.getEntry('IMG_1.jpg')?.header.method).toBe(zipCompressionMethodStored);
  });

  test('動画のみの場合、空のzipとremovedVideoEntriesのみを返す', () => {
    const entries = [{ sourceFileId: 'file-1', archivePath: 'VID_1.mp4', data: Buffer.from('video-1') }];

    const result = consolidateArchiveWithoutVideos(entries);

    expect(result.keptEntries).toEqual([]);
    expect(result.removedVideoEntries).toEqual([{ sourceFileId: 'file-1', archivePath: 'VID_1.mp4' }]);
    const zip = new AdmZip(result.zipBuffer);
    expect(zip.getEntries()).toEqual([]);
  });
});
