import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { GoogleDriveApiClient } from '../../google-drive/google-drive-api.client';
import { GoogleDriveAuthService } from '../../google-drive/google-drive-auth.service';
import { PhotoEntity } from '../entities/photo.entity';
import { groupPhotosByYearMonth } from '../group-photos-by-year-month.util';
import { MonthlyPhotoArchiveService } from '../monthly-photo-archive.service';
import { PhotoIngestService } from '../photo-ingest.service';
import { extractTakeoutArchive } from '../takeout-archive.util';
import { resolvePhotoMetadata } from '../takeout-metadata.util';
import { matchPhotosWithJsonSidecars } from '../takeout-photo-matcher.util';

vi.mock('../takeout-archive.util', () => ({ extractTakeoutArchive: vi.fn() }));
vi.mock('../takeout-photo-matcher.util', () => ({ matchPhotosWithJsonSidecars: vi.fn() }));
// JSON優先・EXIFフォールバックの具体的な分岐ロジック自体はtakeout-metadata.util.tests.tsで検証済みのため、
// ここではPhotoIngestServiceがresolvePhotoMetadataの結果(メタデータ有無)をどう扱うかのみを検証する
vi.mock('../takeout-metadata.util', () => ({ resolvePhotoMetadata: vi.fn() }));
vi.mock('../group-photos-by-year-month.util', () => ({ groupPhotosByYearMonth: vi.fn() }));

const createPhotoEntry = (path: string) => ({ path, data: Buffer.from(path) });

describe('PhotoIngestServiceに関するテスト', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createService = async ({
    getAccessToken,
    downloadFile,
    reorganize,
    save
  }: {
    getAccessToken: ReturnType<typeof vi.fn>;
    downloadFile: ReturnType<typeof vi.fn>;
    reorganize: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  }) => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PhotoIngestService,
        { provide: GoogleDriveAuthService, useValue: { getAccessToken } },
        { provide: GoogleDriveApiClient, useValue: { downloadFile } },
        { provide: MonthlyPhotoArchiveService, useValue: { reorganize } },
        { provide: getRepositoryToken(PhotoEntity), useValue: { save } }
      ]
    }).compile();

    return moduleRef.get(PhotoIngestService);
  };

  test('アクセストークンでzipをダウンロードし、月別アーカイブへ振り分けた結果をリポジトリへ保存する', async () => {
    const getAccessToken = vi.fn().mockResolvedValue('access-token-1');
    const downloadFile = vi.fn().mockResolvedValue(Buffer.from('zip-content'));
    const save = vi.fn().mockResolvedValue(undefined);
    const photo = createPhotoEntry('album/IMG_1.jpg');
    const json = createPhotoEntry('album/IMG_1.jpg.json');
    vi.mocked(extractTakeoutArchive).mockReturnValue({ photoEntries: [photo], jsonEntries: [json] });
    vi.mocked(matchPhotosWithJsonSidecars).mockReturnValue([{ photo, json }]);
    const takenAt = new Date('2026-07-01T00:00:00.000Z');
    vi.mocked(resolvePhotoMetadata).mockResolvedValue({ takenAt, location: null });
    const photoWithMetadata = { entry: photo, metadata: { takenAt, location: null } };
    vi.mocked(groupPhotosByYearMonth).mockReturnValue([{ yearMonth: '2026-07', photos: [photoWithMetadata] }]);
    const reorganize = vi
      .fn()
      .mockResolvedValue([{ photo: photoWithMetadata, sourceFileId: 'monthly-file-1', archivePath: 'IMG_1.jpg' }]);
    const service = await createService({ getAccessToken, downloadFile, reorganize, save });

    const result = await service.ingest('file-1');

    expect(getAccessToken).toHaveBeenCalledTimes(1);
    expect(downloadFile).toHaveBeenCalledWith('access-token-1', 'file-1');
    expect(extractTakeoutArchive).toHaveBeenCalledWith(Buffer.from('zip-content'));
    expect(resolvePhotoMetadata).toHaveBeenCalledWith(photo, json);
    expect(groupPhotosByYearMonth).toHaveBeenCalledWith([photoWithMetadata]);
    expect(reorganize).toHaveBeenCalledWith('access-token-1', [{ yearMonth: '2026-07', photos: [photoWithMetadata] }]);
    expect(save).toHaveBeenCalledWith([
      expect.objectContaining({
        fileName: 'IMG_1.jpg',
        takenAt,
        location: null,
        sourceFileId: 'monthly-file-1',
        archivePath: 'IMG_1.jpg'
      })
    ]);
    expect(result).toEqual({ savedCount: 1, skippedCount: 0 });
  });

  test('メタデータが取得できない写真は、グルーピング対象から除外されスキップ件数に加算される', async () => {
    const getAccessToken = vi.fn().mockResolvedValue('access-token-1');
    const downloadFile = vi.fn().mockResolvedValue(Buffer.from('zip-content'));
    const save = vi.fn().mockResolvedValue(undefined);
    const photo = createPhotoEntry('album/IMG_4.jpg');
    vi.mocked(extractTakeoutArchive).mockReturnValue({ photoEntries: [photo], jsonEntries: [] });
    vi.mocked(matchPhotosWithJsonSidecars).mockReturnValue([{ photo, json: null }]);
    vi.mocked(resolvePhotoMetadata).mockResolvedValue(null);
    vi.mocked(groupPhotosByYearMonth).mockReturnValue([]);
    const reorganize = vi.fn().mockResolvedValue([]);
    const service = await createService({ getAccessToken, downloadFile, reorganize, save });

    const result = await service.ingest('file-1');

    expect(groupPhotosByYearMonth).toHaveBeenCalledWith([]);
    expect(save).not.toHaveBeenCalled();
    expect(result).toEqual({ savedCount: 0, skippedCount: 1 });
  });

  test('複数の写真を処理し、保存件数とスキップ件数をそれぞれ正しく集計する', async () => {
    const getAccessToken = vi.fn().mockResolvedValue('access-token-1');
    const downloadFile = vi.fn().mockResolvedValue(Buffer.from('zip-content'));
    const save = vi.fn().mockResolvedValue(undefined);
    const photoWithMetadataEntry = createPhotoEntry('album/IMG_5.jpg');
    const jsonWithMetadata = createPhotoEntry('album/IMG_5.jpg.json');
    const photoWithoutMetadata = createPhotoEntry('album/IMG_6.jpg');
    vi.mocked(extractTakeoutArchive).mockReturnValue({
      photoEntries: [photoWithMetadataEntry, photoWithoutMetadata],
      jsonEntries: [jsonWithMetadata]
    });
    vi.mocked(matchPhotosWithJsonSidecars).mockReturnValue([
      { photo: photoWithMetadataEntry, json: jsonWithMetadata },
      { photo: photoWithoutMetadata, json: null }
    ]);
    const takenAt = new Date('2026-07-05T00:00:00.000Z');
    vi.mocked(resolvePhotoMetadata).mockResolvedValueOnce({ takenAt, location: null }).mockResolvedValueOnce(null);
    const photoWithMetadata = { entry: photoWithMetadataEntry, metadata: { takenAt, location: null } };
    vi.mocked(groupPhotosByYearMonth).mockReturnValue([{ yearMonth: '2026-07', photos: [photoWithMetadata] }]);
    const reorganize = vi
      .fn()
      .mockResolvedValue([{ photo: photoWithMetadata, sourceFileId: 'monthly-file-1', archivePath: 'IMG_5.jpg' }]);
    const service = await createService({ getAccessToken, downloadFile, reorganize, save });

    const result = await service.ingest('file-1');

    expect(result).toEqual({ savedCount: 1, skippedCount: 1 });
  });
});
