import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { CyclingActivityEntity } from '../../activities/entities/cycling-activity.entity';
import { PhotoEntity } from '../entities/photo.entity';
import { PhotosService } from '../photos.service';

describe('PhotosServiceに関するテスト', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createService = async ({
    findOneBy,
    find
  }: {
    findOneBy: ReturnType<typeof vi.fn>;
    find: ReturnType<typeof vi.fn>;
  }) => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PhotosService,
        { provide: getRepositoryToken(CyclingActivityEntity), useValue: { findOneBy } },
        { provide: getRepositoryToken(PhotoEntity), useValue: { find } }
      ]
    }).compile();

    return moduleRef.get(PhotosService);
  };

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
