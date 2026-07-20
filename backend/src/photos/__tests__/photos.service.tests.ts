import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import AdmZip from 'adm-zip';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { CyclingActivityEntity } from '../../activities/entities/cycling-activity.entity';
import { GoogleDriveApiClient } from '../../google-drive/google-drive-api.client';
import { GoogleDriveAuthService } from '../../google-drive/google-drive-auth.service';
import { PhotoEntity } from '../entities/photo.entity';
import { PhotosService } from '../photos.service';

/** テスト用のzipバッファを組み立てる（adm-zipの実物で検証する） */
const buildZip = (entries: { path: string; content: string }[]): Buffer => {
  const zip = new AdmZip();
  for (const entry of entries) {
    zip.addFile(entry.path, Buffer.from(entry.content));
  }
  return zip.toBuffer();
};

describe('PhotosServiceに関するテスト', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createService = async ({
    findOneBy = vi.fn(),
    find = vi.fn(),
    photoFindOneBy = vi.fn(),
    getAccessToken = vi.fn(),
    downloadFile = vi.fn()
  }: {
    findOneBy?: ReturnType<typeof vi.fn>;
    find?: ReturnType<typeof vi.fn>;
    photoFindOneBy?: ReturnType<typeof vi.fn>;
    getAccessToken?: ReturnType<typeof vi.fn>;
    downloadFile?: ReturnType<typeof vi.fn>;
  }) => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PhotosService,
        { provide: getRepositoryToken(CyclingActivityEntity), useValue: { findOneBy } },
        { provide: getRepositoryToken(PhotoEntity), useValue: { find, findOneBy: photoFindOneBy } },
        { provide: GoogleDriveAuthService, useValue: { getAccessToken } },
        { provide: GoogleDriveApiClient, useValue: { downloadFile } }
      ]
    }).compile();

    return moduleRef.get(PhotosService);
  };

  describe('findByActivityに関するテスト', () => {
    test('アクティビティの開始日時〜終了日時(開始日時+経過時間)の範囲で撮影された写真を撮影日時順で返す', async () => {
      const startDate = new Date('2026-07-01T00:00:00.000Z');
      const findOneBy = vi.fn().mockResolvedValue({
        id: '1',
        startDate,
        elapsedTimeSeconds: 3600
      });
      const takenAt = new Date('2026-07-01T00:30:00.000Z');
      const photos = [{ id: 1, fileName: 'a.jpg', takenAt, location: null }];
      const find = vi.fn().mockResolvedValue(photos);
      const service = await createService({ findOneBy, find });

      const result = await service.findByActivity('1');

      expect(findOneBy).toHaveBeenCalledWith({ id: '1' });
      expect(find).toHaveBeenCalledWith({
        where: {
          takenAt: expect.objectContaining({
            _type: 'between',
            _value: [startDate, new Date('2026-07-01T01:00:00.000Z')]
          })
        },
        order: { takenAt: 'ASC' }
      });
      expect(result).toEqual([{ id: 1, fileName: 'a.jpg', takenAt: takenAt.toISOString(), location: null }]);
    });

    test('対象のアクティビティが存在しない場合、空配列を返す', async () => {
      const findOneBy = vi.fn().mockResolvedValue(null);
      const find = vi.fn();
      const service = await createService({ findOneBy, find });

      const result = await service.findByActivity('missing');

      expect(result).toEqual([]);
      expect(find).not.toHaveBeenCalled();
    });
  });

  describe('findImageByPhotoIdに関するテスト', () => {
    test('対象の写真が存在する場合、月別アーカイブzipから実バイナリを取り出しContent-Typeとともに返す', async () => {
      const zipBuffer = buildZip([{ path: '2026-07/IMG_1234.jpg', content: 'binary-image-data' }]);
      const photoFindOneBy = vi.fn().mockResolvedValue({
        id: 1,
        fileName: 'IMG_1234.jpg',
        sourceFileId: 'zip-1',
        archivePath: '2026-07/IMG_1234.jpg'
      });
      const getAccessToken = vi.fn().mockResolvedValue('access-token');
      const downloadFile = vi.fn().mockResolvedValue(zipBuffer);
      const service = await createService({ photoFindOneBy, getAccessToken, downloadFile });

      const result = await service.findImageByPhotoId(1);

      expect(photoFindOneBy).toHaveBeenCalledWith({ id: 1 });
      expect(downloadFile).toHaveBeenCalledWith('access-token', 'zip-1');
      expect(result).toEqual({ data: Buffer.from('binary-image-data'), contentType: 'image/jpeg' });
    });

    test('対象の写真が存在しない場合、nullを返す', async () => {
      const photoFindOneBy = vi.fn().mockResolvedValue(null);
      const downloadFile = vi.fn();
      const service = await createService({ photoFindOneBy, downloadFile });

      const result = await service.findImageByPhotoId(999);

      expect(result).toBeNull();
      expect(downloadFile).not.toHaveBeenCalled();
    });

    test('月別アーカイブzip内に対応するエントリが見つからない場合、nullを返す', async () => {
      const zipBuffer = buildZip([{ path: '2026-07/OTHER.jpg', content: 'other-data' }]);
      const photoFindOneBy = vi.fn().mockResolvedValue({
        id: 1,
        fileName: 'IMG_1234.jpg',
        sourceFileId: 'zip-1',
        archivePath: '2026-07/IMG_1234.jpg'
      });
      const getAccessToken = vi.fn().mockResolvedValue('access-token');
      const downloadFile = vi.fn().mockResolvedValue(zipBuffer);
      const service = await createService({ photoFindOneBy, getAccessToken, downloadFile });

      const result = await service.findImageByPhotoId(1);

      expect(result).toBeNull();
    });

    test('同じ月別アーカイブzipに属する写真を続けて取得する場合、2回目以降はキャッシュを使い再ダウンロードしない', async () => {
      const zipBuffer = buildZip([
        { path: '2026-07/IMG_1234.jpg', content: 'binary-image-data-1' },
        { path: '2026-07/IMG_5678.jpg', content: 'binary-image-data-2' }
      ]);
      const photoFindOneBy = vi
        .fn()
        .mockResolvedValueOnce({
          id: 1,
          fileName: 'IMG_1234.jpg',
          sourceFileId: 'zip-1',
          archivePath: '2026-07/IMG_1234.jpg'
        })
        .mockResolvedValueOnce({
          id: 2,
          fileName: 'IMG_5678.jpg',
          sourceFileId: 'zip-1',
          archivePath: '2026-07/IMG_5678.jpg'
        });
      const getAccessToken = vi.fn().mockResolvedValue('access-token');
      const downloadFile = vi.fn().mockResolvedValue(zipBuffer);
      const service = await createService({ photoFindOneBy, getAccessToken, downloadFile });

      await service.findImageByPhotoId(1);
      const result = await service.findImageByPhotoId(2);

      expect(downloadFile).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ data: Buffer.from('binary-image-data-2'), contentType: 'image/jpeg' });
    });
  });
});
