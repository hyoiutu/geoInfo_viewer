import { afterEach, describe, expect, test, vi } from 'vitest';
import { fetchCyclingActivities, getBackfillStatus, startBackfill, syncCyclingActivities } from '../activitiesApi';

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

  test('レスポンスが異常なとき、エラーを投げる', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchCyclingActivities()).rejects.toThrow();
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

  test('レスポンスが異常なとき、success:falseを返す', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal('fetch', fetchMock);

    const result = await syncCyclingActivities();

    expect(result).toEqual({ success: false });
  });

  test('fetch自体が失敗したとき、success:falseを返す', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network error'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await syncCyclingActivities();

    expect(result).toEqual({ success: false });
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

  test('レスポンスが異常なとき、started:falseを返す', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal('fetch', fetchMock);

    const result = await startBackfill();

    expect(result).toEqual({ started: false });
  });

  test('fetch自体が失敗したとき、started:falseを返す', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network error'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await startBackfill();

    expect(result).toEqual({ started: false });
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
      estimatedRemainingSeconds: 27
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

  test('レスポンスが異常なとき、エラーを投げる', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal('fetch', fetchMock);

    await expect(getBackfillStatus()).rejects.toThrow();
  });
});
