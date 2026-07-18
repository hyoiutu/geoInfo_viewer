import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { GoogleDriveApiClient } from '../../google-drive/google-drive-api.client';
import { GoogleDriveAuthService } from '../../google-drive/google-drive-auth.service';
import { PhotoEntity } from '../entities/photo.entity';
import { PhotoIngestService } from '../photo-ingest.service';
import { extractTakeoutArchive } from '../takeout-archive.util';
import { extractMetadataFromExif, extractMetadataFromJson } from '../takeout-metadata.util';
import { matchPhotosWithJsonSidecars } from '../takeout-photo-matcher.util';

vi.mock('../takeout-archive.util', () => ({ extractTakeoutArchive: vi.fn() }));
vi.mock('../takeout-photo-matcher.util', () => ({ matchPhotosWithJsonSidecars: vi.fn() }));
vi.mock('../takeout-metadata.util', () => ({
  extractMetadataFromJson: vi.fn(),
  extractMetadataFromExif: vi.fn()
}));

const createPhotoEntry = (path: string) => ({ path, data: Buffer.from(path) });

describe('PhotoIngestServiceに関するテスト', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createService = async ({
    getAccessToken,
    downloadFile,
    save
  }: {
    getAccessToken: ReturnType<typeof vi.fn>;
    downloadFile: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  }) => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PhotoIngestService,
        { provide: GoogleDriveAuthService, useValue: { getAccessToken } },
        { provide: GoogleDriveApiClient, useValue: { downloadFile } },
        { provide: getRepositoryToken(PhotoEntity), useValue: { save } }
      ]
    }).compile();

    return moduleRef.get(PhotoIngestService);
  };

  test('アクセストークンでzipをダウンロードし、写真エントリの解析結果をリポジトリへ保存する', async () => {
    const getAccessToken = vi.fn().mockResolvedValue('access-token-1');
    const downloadFile = vi.fn().mockResolvedValue(Buffer.from('zip-content'));
    const save = vi.fn().mockResolvedValue(undefined);
    const photo = createPhotoEntry('album/IMG_1.jpg');
    const json = createPhotoEntry('album/IMG_1.jpg.json');
    vi.mocked(extractTakeoutArchive).mockReturnValue({ photoEntries: [photo], jsonEntries: [json] });
    vi.mocked(matchPhotosWithJsonSidecars).mockReturnValue([{ photo, json }]);
    const takenAt = new Date('2026-07-01T00:00:00.000Z');
    vi.mocked(extractMetadataFromJson).mockReturnValue({ takenAt, location: null });
    const service = await createService({ getAccessToken, downloadFile, save });

    const result = await service.ingest('file-1');

    expect(getAccessToken).toHaveBeenCalledTimes(1);
    expect(downloadFile).toHaveBeenCalledWith('access-token-1', 'file-1');
    expect(extractTakeoutArchive).toHaveBeenCalledWith(Buffer.from('zip-content'));
    expect(save).toHaveBeenCalledWith([
      expect.objectContaining({
        fileName: 'IMG_1.jpg',
        takenAt,
        location: null,
        sourceFileId: 'file-1',
        archivePath: 'album/IMG_1.jpg'
      })
    ]);
    expect(result).toEqual({ savedCount: 1, skippedCount: 0 });
  });

  test('jsonがnull(対応するJSONサイドカーが見つからない)の場合、EXIFからのメタデータ抽出にフォールバックする', async () => {
    const getAccessToken = vi.fn().mockResolvedValue('access-token-1');
    const downloadFile = vi.fn().mockResolvedValue(Buffer.from('zip-content'));
    const save = vi.fn().mockResolvedValue(undefined);
    const photo = createPhotoEntry('album/IMG_2.jpg');
    vi.mocked(extractTakeoutArchive).mockReturnValue({ photoEntries: [photo], jsonEntries: [] });
    vi.mocked(matchPhotosWithJsonSidecars).mockReturnValue([{ photo, json: null }]);
    const takenAt = new Date('2026-07-02T00:00:00.000Z');
    vi.mocked(extractMetadataFromExif).mockResolvedValue({ takenAt, location: null });
    const service = await createService({ getAccessToken, downloadFile, save });

    const result = await service.ingest('file-1');

    expect(extractMetadataFromJson).not.toHaveBeenCalled();
    expect(extractMetadataFromExif).toHaveBeenCalledWith(photo.data);
    expect(result).toEqual({ savedCount: 1, skippedCount: 0 });
  });

  test('JSONの解析に失敗した場合も、EXIFからのメタデータ抽出にフォールバックする', async () => {
    const getAccessToken = vi.fn().mockResolvedValue('access-token-1');
    const downloadFile = vi.fn().mockResolvedValue(Buffer.from('zip-content'));
    const save = vi.fn().mockResolvedValue(undefined);
    const photo = createPhotoEntry('album/IMG_3.jpg');
    const json = createPhotoEntry('album/IMG_3.jpg.json');
    vi.mocked(extractTakeoutArchive).mockReturnValue({ photoEntries: [photo], jsonEntries: [json] });
    vi.mocked(matchPhotosWithJsonSidecars).mockReturnValue([{ photo, json }]);
    vi.mocked(extractMetadataFromJson).mockReturnValue(null);
    const takenAt = new Date('2026-07-03T00:00:00.000Z');
    vi.mocked(extractMetadataFromExif).mockResolvedValue({ takenAt, location: null });
    const service = await createService({ getAccessToken, downloadFile, save });

    const result = await service.ingest('file-1');

    expect(extractMetadataFromExif).toHaveBeenCalledWith(photo.data);
    expect(result).toEqual({ savedCount: 1, skippedCount: 0 });
  });

  test('JSON・EXIFいずれからもメタデータが取得できない写真は、保存されずスキップ件数に加算される', async () => {
    const getAccessToken = vi.fn().mockResolvedValue('access-token-1');
    const downloadFile = vi.fn().mockResolvedValue(Buffer.from('zip-content'));
    const save = vi.fn().mockResolvedValue(undefined);
    const photo = createPhotoEntry('album/IMG_4.jpg');
    vi.mocked(extractTakeoutArchive).mockReturnValue({ photoEntries: [photo], jsonEntries: [] });
    vi.mocked(matchPhotosWithJsonSidecars).mockReturnValue([{ photo, json: null }]);
    vi.mocked(extractMetadataFromExif).mockResolvedValue(null);
    const service = await createService({ getAccessToken, downloadFile, save });

    const result = await service.ingest('file-1');

    expect(save).not.toHaveBeenCalled();
    expect(result).toEqual({ savedCount: 0, skippedCount: 1 });
  });

  test('複数の写真を処理し、保存件数とスキップ件数をそれぞれ正しく集計する', async () => {
    const getAccessToken = vi.fn().mockResolvedValue('access-token-1');
    const downloadFile = vi.fn().mockResolvedValue(Buffer.from('zip-content'));
    const save = vi.fn().mockResolvedValue(undefined);
    const photoWithMetadata = createPhotoEntry('album/IMG_5.jpg');
    const jsonWithMetadata = createPhotoEntry('album/IMG_5.jpg.json');
    const photoWithoutMetadata = createPhotoEntry('album/IMG_6.jpg');
    vi.mocked(extractTakeoutArchive).mockReturnValue({
      photoEntries: [photoWithMetadata, photoWithoutMetadata],
      jsonEntries: [jsonWithMetadata]
    });
    vi.mocked(matchPhotosWithJsonSidecars).mockReturnValue([
      { photo: photoWithMetadata, json: jsonWithMetadata },
      { photo: photoWithoutMetadata, json: null }
    ]);
    vi.mocked(extractMetadataFromJson).mockReturnValue({
      takenAt: new Date('2026-07-05T00:00:00.000Z'),
      location: null
    });
    vi.mocked(extractMetadataFromExif).mockResolvedValue(null);
    const service = await createService({ getAccessToken, downloadFile, save });

    const result = await service.ingest('file-1');

    expect(result).toEqual({ savedCount: 1, skippedCount: 1 });
  });
});
