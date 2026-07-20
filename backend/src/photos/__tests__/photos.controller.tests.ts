import { NotFoundException, StreamableFile } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { describe, expect, test, vi } from 'vitest';
import { PhotoIngestService } from '../photo-ingest.service';
import { PhotosController } from '../photos.controller';
import { PhotosService } from '../photos.service';

describe('PhotosControllerに関するテスト', () => {
  const createController = async ({
    ingest = vi.fn(),
    findImageByPhotoId = vi.fn()
  }: {
    ingest?: ReturnType<typeof vi.fn>;
    findImageByPhotoId?: ReturnType<typeof vi.fn>;
  }) => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PhotosController],
      providers: [
        { provide: PhotoIngestService, useValue: { ingest } },
        { provide: PhotosService, useValue: { findImageByPhotoId } }
      ]
    }).compile();

    return moduleRef.get(PhotosController);
  };

  test('POST /photos/ingest: 指定したfileIdでサービスを呼び出し、結果をそのまま返す', async () => {
    const result = { savedCount: 3, skippedCount: 1 };
    const ingest = vi.fn().mockResolvedValue(result);
    const controller = await createController({ ingest });

    const response = await controller.ingest('file-42');

    expect(response).toEqual(result);
    expect(ingest).toHaveBeenCalledWith('file-42');
  });

  test('GET /photos/:id/image: 対象の写真が存在する場合、バイナリをContent-Type付きのStreamableFileとして返す', async () => {
    const data = Buffer.from('binary-image-data');
    const findImageByPhotoId = vi.fn().mockResolvedValue({ data, contentType: 'image/jpeg' });
    const controller = await createController({ findImageByPhotoId });

    const response = await controller.getImage(1);

    expect(findImageByPhotoId).toHaveBeenCalledWith(1);
    expect(response).toBeInstanceOf(StreamableFile);
  });

  test('GET /photos/:id/image: 対象の写真が存在しない場合、NotFoundExceptionを投げる', async () => {
    const findImageByPhotoId = vi.fn().mockResolvedValue(null);
    const controller = await createController({ findImageByPhotoId });

    await expect(controller.getImage(999)).rejects.toThrow(NotFoundException);
  });
});
