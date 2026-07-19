import { Test } from '@nestjs/testing';
import { describe, expect, test, vi } from 'vitest';
import { PhotoIngestService } from '../photo-ingest.service';
import { PhotosController } from '../photos.controller';

describe('PhotosControllerに関するテスト', () => {
  const createController = async (ingest: ReturnType<typeof vi.fn>) => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PhotosController],
      providers: [{ provide: PhotoIngestService, useValue: { ingest } }]
    }).compile();

    return moduleRef.get(PhotosController);
  };

  test('POST /photos/ingest: 指定したfileIdでサービスを呼び出し、結果をそのまま返す', async () => {
    const result = { savedCount: 3, skippedCount: 1 };
    const ingest = vi.fn().mockResolvedValue(result);
    const controller = await createController(ingest);

    const response = await controller.ingest('file-42');

    expect(response).toEqual(result);
    expect(ingest).toHaveBeenCalledWith('file-42');
  });
});
