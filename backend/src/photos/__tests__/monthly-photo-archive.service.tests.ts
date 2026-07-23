import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { GoogleDriveApiClient } from '../../google-drive/google-drive-api.client';
import { MonthlyPhotoArchiveEntity } from '../entities/monthly-photo-archive.entity';
import type { PhotoWithMetadata } from '../group-photos-by-year-month.util';
import { mergeMonthlyArchive } from '../monthly-archive.util';
import { MonthlyPhotoArchiveService } from '../monthly-photo-archive.service';

vi.mock('../monthly-archive.util', () => ({ mergeMonthlyArchive: vi.fn() }));

const createPhoto = (path: string): PhotoWithMetadata => ({
  entry: { path, data: Buffer.from(path) },
  metadata: { takenAt: new Date('2026-07-01T00:00:00Z'), location: null }
});

describe('MonthlyPhotoArchiveServiceに関するテスト', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createService = async ({
    downloadFile,
    createFileMetadata,
    updateFileContent,
    findOneBy,
    save
  }: {
    downloadFile: ReturnType<typeof vi.fn>;
    createFileMetadata: ReturnType<typeof vi.fn>;
    updateFileContent: ReturnType<typeof vi.fn>;
    findOneBy: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  }) => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        MonthlyPhotoArchiveService,
        { provide: GoogleDriveApiClient, useValue: { downloadFile, createFileMetadata, updateFileContent } },
        { provide: getRepositoryToken(MonthlyPhotoArchiveEntity), useValue: { findOneBy, save } }
      ]
    }).compile();

    return moduleRef.get(MonthlyPhotoArchiveService);
  };

  test('対象年月のアーカイブが既存の場合、既存zipをダウンロードしてマージし、既存ファイルを更新する（新規Entity作成はしない）', async () => {
    const existingArchive = { id: 1, yearMonth: '2026-07', driveFileId: 'existing-file-1' };
    const downloadFile = vi.fn().mockResolvedValue(Buffer.from('existing-zip'));
    const createFileMetadata = vi.fn();
    const updateFileContent = vi.fn().mockResolvedValue(undefined);
    const findOneBy = vi.fn().mockResolvedValue(existingArchive);
    const save = vi.fn().mockResolvedValue(undefined);
    const photo = createPhoto('album/IMG_1.jpg');
    vi.mocked(mergeMonthlyArchive).mockReturnValue({
      zipBuffer: Buffer.from('merged-zip'),
      entries: [{ photo, archivePath: 'IMG_1.jpg' }]
    });
    const service = await createService({ downloadFile, createFileMetadata, updateFileContent, findOneBy, save });

    const result = await service.reorganize('token-xyz', [{ yearMonth: '2026-07', photos: [photo] }]);

    expect(findOneBy).toHaveBeenCalledWith({ yearMonth: '2026-07', part: 0 });
    expect(downloadFile).toHaveBeenCalledWith('token-xyz', 'existing-file-1');
    expect(mergeMonthlyArchive).toHaveBeenCalledWith(Buffer.from('existing-zip'), [photo]);
    expect(createFileMetadata).not.toHaveBeenCalled();
    expect(updateFileContent).toHaveBeenCalledWith('token-xyz', 'existing-file-1', Buffer.from('merged-zip'));
    expect(save).not.toHaveBeenCalled();
    expect(result).toEqual([{ photo, sourceFileId: 'existing-file-1', archivePath: 'IMG_1.jpg' }]);
  });

  test('対象年月のアーカイブが存在しない場合、新規zipを作成しMonthlyPhotoArchiveEntityを保存する', async () => {
    const downloadFile = vi.fn();
    const createFileMetadata = vi.fn().mockResolvedValue('new-file-1');
    const updateFileContent = vi.fn().mockResolvedValue(undefined);
    const findOneBy = vi.fn().mockResolvedValue(null);
    const save = vi.fn().mockResolvedValue(undefined);
    const photo = createPhoto('album/IMG_2.jpg');
    vi.mocked(mergeMonthlyArchive).mockReturnValue({
      zipBuffer: Buffer.from('new-zip'),
      entries: [{ photo, archivePath: 'IMG_2.jpg' }]
    });
    const service = await createService({ downloadFile, createFileMetadata, updateFileContent, findOneBy, save });

    const result = await service.reorganize('token-xyz', [{ yearMonth: '2026-08', photos: [photo] }]);

    expect(downloadFile).not.toHaveBeenCalled();
    expect(mergeMonthlyArchive).toHaveBeenCalledWith(null, [photo]);
    expect(createFileMetadata).toHaveBeenCalledWith('token-xyz', '2026-08.zip');
    expect(updateFileContent).toHaveBeenCalledWith('token-xyz', 'new-file-1', Buffer.from('new-zip'));
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ yearMonth: '2026-08', part: 0, driveFileId: 'new-file-1' })
    );
    expect(result).toEqual([{ photo, sourceFileId: 'new-file-1', archivePath: 'IMG_2.jpg' }]);
  });

  test('partが1以上の場合、ファイル名にpart番号を含めて新規zipを作成する', async () => {
    const downloadFile = vi.fn();
    const createFileMetadata = vi.fn().mockResolvedValue('new-file-2');
    const updateFileContent = vi.fn().mockResolvedValue(undefined);
    const findOneBy = vi.fn().mockResolvedValue(null);
    const save = vi.fn().mockResolvedValue(undefined);
    const photo = createPhoto('album/IMG_3.jpg');
    vi.mocked(mergeMonthlyArchive).mockReturnValue({
      zipBuffer: Buffer.from('new-zip-2'),
      entries: [{ photo, archivePath: 'IMG_3.jpg' }]
    });
    const service = await createService({ downloadFile, createFileMetadata, updateFileContent, findOneBy, save });

    await service.reorganize('token-xyz', [{ yearMonth: '2026-08', part: 1, photos: [photo] }]);

    expect(findOneBy).toHaveBeenCalledWith({ yearMonth: '2026-08', part: 1 });
    expect(createFileMetadata).toHaveBeenCalledWith('token-xyz', '2026-08-part2.zip');
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ yearMonth: '2026-08', part: 1, driveFileId: 'new-file-2' })
    );
  });

  test('複数年月のグループをそれぞれ処理し、結果を1つの配列にまとめる', async () => {
    const existingArchive = { id: 1, yearMonth: '2026-07', driveFileId: 'existing-file-1' };
    const downloadFile = vi.fn().mockResolvedValue(Buffer.from('existing-zip'));
    const createFileMetadata = vi.fn().mockResolvedValue('new-file-1');
    const updateFileContent = vi.fn().mockResolvedValue(undefined);
    const findOneBy = vi
      .fn()
      .mockImplementation(({ yearMonth }: { yearMonth: string }) =>
        Promise.resolve(yearMonth === '2026-07' ? existingArchive : null)
      );
    const save = vi.fn().mockResolvedValue(undefined);
    const photo1 = createPhoto('album/IMG_1.jpg');
    const photo2 = createPhoto('album/IMG_2.jpg');
    vi.mocked(mergeMonthlyArchive)
      .mockReturnValueOnce({
        zipBuffer: Buffer.from('merged-1'),
        entries: [{ photo: photo1, archivePath: 'IMG_1.jpg' }]
      })
      .mockReturnValueOnce({
        zipBuffer: Buffer.from('merged-2'),
        entries: [{ photo: photo2, archivePath: 'IMG_2.jpg' }]
      });
    const service = await createService({ downloadFile, createFileMetadata, updateFileContent, findOneBy, save });

    const result = await service.reorganize('token-xyz', [
      { yearMonth: '2026-07', photos: [photo1] },
      { yearMonth: '2026-08', photos: [photo2] }
    ]);

    expect(result).toEqual([
      { photo: photo1, sourceFileId: 'existing-file-1', archivePath: 'IMG_1.jpg' },
      { photo: photo2, sourceFileId: 'new-file-1', archivePath: 'IMG_2.jpg' }
    ]);
  });
});
