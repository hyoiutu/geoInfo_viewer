import { afterEach, describe, expect, test, vi } from 'vitest';
import { ApiError } from '../../utils/apiError';
import {
  fetchCyclingActivities,
  fetchPassedMunicipalities,
  getBackfillStatus,
  startBackfill,
  syncCyclingActivities
} from '../activitiesApi';

describe('fetchCyclingActivitiesに関するテスト', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('レスポンスが正常なとき、アクティビティ配列を返す', async () => {
    const activities = [
      {
        id: 1,
        name: 'ライド1',
        distanceMeters: 1000,
        movingTimeSeconds: 600,
        startDate: '2026-07-01T00:00:00Z',
        path: null
      }
    ];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(activities)
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchCyclingActivities();

    expect(result).toEqual(activities);
  });

  test('レスポンスが異常なとき、ApiErrorを投げる', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, json: () => Promise.reject(new Error()) });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchCyclingActivities()).rejects.toBeInstanceOf(ApiError);
  });
});

describe('syncCyclingActivitiesに関するテスト', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('POSTでsyncエンドポイントを呼び出し、レスポンスのsuccessをそのまま返す', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true })
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await syncCyclingActivities();

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3000/activities/sync', { method: 'POST' });
    expect(result).toEqual({ success: true });
  });

  test('レスポンスが異常なとき、ApiErrorを投げる', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, json: () => Promise.reject(new Error()) });
    vi.stubGlobal('fetch', fetchMock);

    await expect(syncCyclingActivities()).rejects.toBeInstanceOf(ApiError);
  });

  test('fetch自体が失敗したとき、エラーを投げる', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network error'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(syncCyclingActivities()).rejects.toThrow('network error');
  });
});

describe('startBackfillに関するテスト', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('POSTでbackfillエンドポイントを呼び出し、レスポンスのstartedをそのまま返す', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ started: true })
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await startBackfill();

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3000/activities/backfill', { method: 'POST' });
    expect(result).toEqual({ started: true });
  });

  test('レスポンスが異常なとき、ApiErrorを投げる', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, json: () => Promise.reject(new Error()) });
    vi.stubGlobal('fetch', fetchMock);

    await expect(startBackfill()).rejects.toBeInstanceOf(ApiError);
  });

  test('fetch自体が失敗したとき、エラーを投げる', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network error'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(startBackfill()).rejects.toThrow('network error');
  });
});

describe('getBackfillStatusに関するテスト', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('GETでbackfill/statusエンドポイントを呼び出し、レスポンスをそのまま返す', async () => {
    const status = {
      isRunning: true,
      totalCount: 4,
      completedCount: 1,
      progressPercent: 25,
      estimatedRemainingSeconds: 27,
      lastError: null
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(status)
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await getBackfillStatus();

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3000/activities/backfill/status');
    expect(result).toEqual(status);
  });

  test('レスポンスが異常なとき、ApiErrorを投げる', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, json: () => Promise.reject(new Error()) });
    vi.stubGlobal('fetch', fetchMock);

    await expect(getBackfillStatus()).rejects.toBeInstanceOf(ApiError);
  });
});

describe('fetchPassedMunicipalitiesに関するテスト', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('GETでactivities/:id/municipalitiesエンドポイントを呼び出し、レスポンスをそのまま返す', async () => {
    const municipalities = [{ prefectureName: '東京都', municipalityName: '千代田区' }];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(municipalities)
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchPassedMunicipalities('123');

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3000/activities/123/municipalities');
    expect(result).toEqual(municipalities);
  });

  test('レスポンスが異常なとき、ApiErrorを投げる', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, json: () => Promise.reject(new Error()) });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchPassedMunicipalities('123')).rejects.toBeInstanceOf(ApiError);
  });
});
