// biome-ignore-all lint/style/useNamingConvention: Strava APIレスポンス形式(snake_case)に合わせたテストダブル
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { StravaActivity } from '../../strava/types/strava-activity.type';
import { CyclingActivityRepository } from '../cycling-activity.repository';
import { CyclingActivityEntity } from '../entities/cycling-activity.entity';

const createActivity = (overrides: Partial<StravaActivity>): StravaActivity => ({
  id: 1,
  name: 'テストライド',
  type: 'Ride',
  distance: 1000,
  moving_time: 600,
  elapsed_time: 650,
  total_elevation_gain: 50,
  start_date: '2026-07-01T00:00:00Z',
  map: { summary_polyline: '' },
  ...overrides
});

// TypeORMのIsNull()/Not(IsNull())はFindOperatorインスタンス(.typeで種別を判別可能)になる
type FindOperatorLike = { type?: string };

describe('CyclingActivityRepositoryに関するテスト', () => {
  let repository: {
    find: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    createQueryBuilder: ReturnType<typeof vi.fn>;
  };
  let queryBuilderExecute: ReturnType<typeof vi.fn>;
  let queryBuilderSet: ReturnType<typeof vi.fn>;

  const createCyclingActivityRepository = async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        CyclingActivityRepository,
        { provide: getRepositoryToken(CyclingActivityEntity), useValue: repository }
      ]
    }).compile();

    return moduleRef.get(CyclingActivityRepository);
  };

  beforeEach(() => {
    queryBuilderExecute = vi.fn().mockResolvedValue(undefined);
    queryBuilderSet = vi.fn().mockReturnValue({ execute: queryBuilderExecute });
    repository = {
      find: vi.fn().mockResolvedValue([]),
      save: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
      createQueryBuilder: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({ set: queryBuilderSet })
      })
    };
  });

  test('findAllは、Repository.find()の結果をそのまま返す', async () => {
    const entity = Object.assign(new CyclingActivityEntity(), { id: '1' });
    repository.find.mockResolvedValue([entity]);
    const cyclingActivityRepository = await createCyclingActivityRepository();

    const result = await cyclingActivityRepository.findAll();

    expect(result).toEqual([entity]);
  });

  test('findPendingDetailは、detailFetchedAtがnullのEntityのみを返す', async () => {
    const pendingEntity = Object.assign(new CyclingActivityEntity(), { id: '1', detailFetchedAt: null });
    repository.find.mockResolvedValue([pendingEntity]);
    const cyclingActivityRepository = await createCyclingActivityRepository();

    const result = await cyclingActivityRepository.findPendingDetail();

    expect(repository.find).toHaveBeenCalledWith({
      where: { detailFetchedAt: expect.objectContaining({ type: 'isNull' }) }
    });
    expect(result).toEqual([pendingEntity]);
  });

  test('saveDetailは、渡されたEntity1件をそのまま保存する', async () => {
    const entity = Object.assign(new CyclingActivityEntity(), { id: '1' });
    const cyclingActivityRepository = await createCyclingActivityRepository();

    await cyclingActivityRepository.saveDetail(entity);

    expect(repository.save).toHaveBeenCalledWith(entity);
  });

  test('saveDetailsは、Entity配列が1件以上あるときのみ保存する', async () => {
    const entities = [Object.assign(new CyclingActivityEntity(), { id: '1' })];
    const cyclingActivityRepository = await createCyclingActivityRepository();

    await cyclingActivityRepository.saveDetails(entities);

    expect(repository.save).toHaveBeenCalledWith(entities);
  });

  test('saveDetailsは、空配列の場合は保存を呼ばない', async () => {
    const cyclingActivityRepository = await createCyclingActivityRepository();

    await cyclingActivityRepository.saveDetails([]);

    expect(repository.save).not.toHaveBeenCalled();
  });

  test('savePlaceholdersIfNotExistsは、DB未登録のアクティビティのみプレースホルダーとして保存する', async () => {
    repository.find.mockResolvedValue([Object.assign(new CyclingActivityEntity(), { id: '1' })]);
    const activities = [createActivity({ id: 1 }), createActivity({ id: 2 })];
    const cyclingActivityRepository = await createCyclingActivityRepository();

    await cyclingActivityRepository.savePlaceholdersIfNotExists(activities);

    expect(repository.save).toHaveBeenCalledWith([
      expect.objectContaining({ id: '2', path: null, detailFetchedAt: null })
    ]);
  });

  test('savePlaceholdersIfNotExistsは、新規分が無い場合は保存を呼ばない', async () => {
    repository.find.mockResolvedValue([Object.assign(new CyclingActivityEntity(), { id: '1' })]);
    const activities = [createActivity({ id: 1 })];
    const cyclingActivityRepository = await createCyclingActivityRepository();

    await cyclingActivityRepository.savePlaceholdersIfNotExists(activities);

    expect(repository.save).not.toHaveBeenCalled();
  });

  test('resetAllDetailFetchedAtは、全件のdetailFetchedAtをnullに更新する', async () => {
    const cyclingActivityRepository = await createCyclingActivityRepository();

    await cyclingActivityRepository.resetAllDetailFetchedAt();

    expect(queryBuilderSet).toHaveBeenCalledWith({ detailFetchedAt: null });
    expect(queryBuilderExecute).toHaveBeenCalled();
  });

  test('countAllは、Repository.count()の結果をそのまま返す', async () => {
    repository.count.mockResolvedValue(4);
    const cyclingActivityRepository = await createCyclingActivityRepository();

    const result = await cyclingActivityRepository.countAll();

    expect(repository.count).toHaveBeenCalledWith();
    expect(result).toBe(4);
  });

  test('countPendingDetailは、detailFetchedAtがnullの件数を返す', async () => {
    repository.count.mockImplementation((options?: { where?: { detailFetchedAt?: FindOperatorLike } }) =>
      Promise.resolve(options?.where?.detailFetchedAt?.type === 'isNull' ? 3 : 0)
    );
    const cyclingActivityRepository = await createCyclingActivityRepository();

    const result = await cyclingActivityRepository.countPendingDetail();

    expect(result).toBe(3);
  });

  test('countCompletedDetailは、detailFetchedAtがnullでない件数を返す', async () => {
    repository.count.mockImplementation((options?: { where?: { detailFetchedAt?: FindOperatorLike } }) =>
      Promise.resolve(options?.where?.detailFetchedAt?.type === 'not' ? 1 : 0)
    );
    const cyclingActivityRepository = await createCyclingActivityRepository();

    const result = await cyclingActivityRepository.countCompletedDetail();

    expect(result).toBe(1);
  });
});
