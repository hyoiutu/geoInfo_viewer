import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { GoogleDriveApiClient } from '../../google-drive/google-drive-api.client';
import { MonthlyPhotoThumbnailArchiveEntity } from '../entities/monthly-photo-thumbnail-archive.entity';
import { mergeMonthlyThumbnailArchive } from '../monthly-archive.util';
import { MonthlyPhotoThumbnailArchiveService } from '../monthly-photo-thumbnail-archive.service';

vi.mock('../monthly-archive.util', () => ({ mergeMonthlyThumbnailArchive: vi.fn() }));

describe('MonthlyPhotoThumbnailArchiveServiceに関するテスト（Issue #104）', () => {
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
        MonthlyPhotoThumbnailArchiveService,
        { provide: GoogleDriveApiClient, useValue: { downloadFile, createFileMetadata, updateFileContent } },
        { provide: getRepositoryToken(MonthlyPhotoThumbnailArchiveEntity), useValue: { findOneBy, save } }
      ]
    }).compile();

    return moduleRef.get(MonthlyPhotoThumbnailArchiveService);
  };

  test('対象年月のサムネイルアーカイブが既存の場合、既存zipをダウンロードしてマージし、既存ファイルを更新する（新規Entity作成はしない）', async () => {
    const existingArchive = { yearMonth: '2026-07', driveFileId: 'existing-thumb-1' };
    const downloadFile = vi.fn().mockResolvedValue(Buffer.from('existing-thumb-zip'));
    const createFileMetadata = vi.fn();
    const updateFileContent = vi.fn().mockResolvedValue(undefined);
    const findOneBy = vi.fn().mockResolvedValue(existingArchive);
    const save = vi.fn().mockResolvedValue(undefined);
    const thumbnail = { archivePath: 'IMG_1.jpg', buffer: Buffer.from('thumb-1') };
    vi.mocked(mergeMonthlyThumbnailArchive).mockReturnValue(Buffer.from('merged-thumb-zip'));
    const service = await createService({ downloadFile, createFileMetadata, updateFileContent, findOneBy, save });

    await service.appendThumbnails('token-xyz', '2026-07', [thumbnail]);

    expect(findOneBy).toHaveBeenCalledWith({ yearMonth: '2026-07' });
    expect(downloadFile).toHaveBeenCalledWith('token-xyz', 'existing-thumb-1');
    expect(mergeMonthlyThumbnailArchive).toHaveBeenCalledWith(Buffer.from('existing-thumb-zip'), [thumbnail]);
    expect(createFileMetadata).not.toHaveBeenCalled();
    expect(updateFileContent).toHaveBeenCalledWith('token-xyz', 'existing-thumb-1', Buffer.from('merged-thumb-zip'));
    expect(save).not.toHaveBeenCalled();
  });

  test('対象年月のサムネイルアーカイブが存在しない場合、新規zipを作成しMonthlyPhotoThumbnailArchiveEntityを保存する', async () => {
    const downloadFile = vi.fn();
    const createFileMetadata = vi.fn().mockResolvedValue('new-thumb-1');
    const updateFileContent = vi.fn().mockResolvedValue(undefined);
    const findOneBy = vi.fn().mockResolvedValue(null);
    const save = vi.fn().mockResolvedValue(undefined);
    const thumbnail = { archivePath: 'IMG_2.jpg', buffer: Buffer.from('thumb-2') };
    vi.mocked(mergeMonthlyThumbnailArchive).mockReturnValue(Buffer.from('new-thumb-zip'));
    const service = await createService({ downloadFile, createFileMetadata, updateFileContent, findOneBy, save });

    await service.appendThumbnails('token-xyz', '2026-08', [thumbnail]);

    expect(downloadFile).not.toHaveBeenCalled();
    expect(mergeMonthlyThumbnailArchive).toHaveBeenCalledWith(null, [thumbnail]);
    expect(createFileMetadata).toHaveBeenCalledWith('token-xyz', '2026-08-thumbnails.zip');
    expect(updateFileContent).toHaveBeenCalledWith('token-xyz', 'new-thumb-1', Buffer.from('new-thumb-zip'));
    expect(save).toHaveBeenCalledWith({ yearMonth: '2026-08', driveFileId: 'new-thumb-1' });
  });

  test('partを跨いだ複数回の呼び出しでも、常に同じ1つのzip（part列を持たない）へ追記していく（Issue #91の日付ベース分割との併用）', async () => {
    const downloadFile = vi.fn().mockResolvedValueOnce(undefined).mockResolvedValueOnce(Buffer.from('after-part0'));
    const createFileMetadata = vi.fn().mockResolvedValue('new-thumb-2');
    const updateFileContent = vi.fn().mockResolvedValue(undefined);
    const findOneBy = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ yearMonth: '2026-09', driveFileId: 'new-thumb-2' });
    const save = vi.fn().mockResolvedValue(undefined);
    vi.mocked(mergeMonthlyThumbnailArchive)
      .mockReturnValueOnce(Buffer.from('after-part0'))
      .mockReturnValueOnce(Buffer.from('after-part1'));
    const service = await createService({ downloadFile, createFileMetadata, updateFileContent, findOneBy, save });

    await service.appendThumbnails('token-xyz', '2026-09', [{ archivePath: 'IMG_3.jpg', buffer: Buffer.from('t3') }]);
    await service.appendThumbnails('token-xyz', '2026-09', [{ archivePath: 'IMG_4.jpg', buffer: Buffer.from('t4') }]);

    expect(createFileMetadata).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(updateFileContent).toHaveBeenNthCalledWith(2, 'token-xyz', 'new-thumb-2', Buffer.from('after-part1'));
  });

  test('サムネイルが空の場合、何もしない', async () => {
    const downloadFile = vi.fn();
    const createFileMetadata = vi.fn();
    const updateFileContent = vi.fn();
    const findOneBy = vi.fn();
    const save = vi.fn();
    const service = await createService({ downloadFile, createFileMetadata, updateFileContent, findOneBy, save });

    await service.appendThumbnails('token-xyz', '2026-07', []);

    expect(findOneBy).not.toHaveBeenCalled();
    expect(mergeMonthlyThumbnailArchive).not.toHaveBeenCalled();
  });
});
