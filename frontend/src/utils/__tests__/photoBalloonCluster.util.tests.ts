import { describe, expect, test } from 'vitest';
import type { Photo } from '../../api/activitiesApi';
import { buildPhotoClusterIndex, getVisiblePhotoClusters } from '../photoBalloonCluster.util';

const WORLD_BBOX: [number, number, number, number] = [-180, -85, 180, 85];
const HIGH_ZOOM = 20;

const createPhoto = (overrides: Partial<Photo>): Photo => ({
  id: 1,
  fileName: 'IMG_1.jpg',
  takenAt: '2026-07-01T00:00:00.000Z',
  location: { type: 'Point', coordinates: [139.767, 35.681] },
  ...overrides
});

describe('buildPhotoClusterIndex/getVisiblePhotoClustersに関するテスト（Issue #107）', () => {
  test('位置情報を持つ写真のみを対象とし、位置情報が無い写真は無視する', () => {
    const photos = [
      createPhoto({ id: 1, location: { type: 'Point', coordinates: [139.767, 35.681] } }),
      createPhoto({ id: 2, location: null })
    ];
    const index = buildPhotoClusterIndex(photos);

    const result = getVisiblePhotoClusters(index, WORLD_BBOX, HIGH_ZOOM);

    expect(result).toEqual([
      { type: 'single', longitude: 139.767, latitude: 35.681, photoId: 1, fileName: 'IMG_1.jpg' }
    ]);
  });

  test('遠く離れた写真同士はクラスタにならず、それぞれ個別の吹き出しとして返す', () => {
    const photos = [
      createPhoto({ id: 1, fileName: 'a.jpg', location: { type: 'Point', coordinates: [139.767, 35.681] } }),
      createPhoto({ id: 2, fileName: 'b.jpg', location: { type: 'Point', coordinates: [-0.1278, 51.5074] } })
    ];
    const index = buildPhotoClusterIndex(photos);

    const result = getVisiblePhotoClusters(index, WORLD_BBOX, HIGH_ZOOM);

    expect(result).toHaveLength(2);
    expect(result).toContainEqual({
      type: 'single',
      longitude: 139.767,
      latitude: 35.681,
      photoId: 1,
      fileName: 'a.jpg'
    });
    expect(result).toContainEqual({
      type: 'single',
      longitude: -0.1278,
      latitude: 51.5074,
      photoId: 2,
      fileName: 'b.jpg'
    });
  });

  test('近接する写真は低ズームレベルで1つのクラスタにまとめられる', () => {
    const photos = [
      createPhoto({ id: 1, location: { type: 'Point', coordinates: [139.767, 35.681] } }),
      createPhoto({ id: 2, location: { type: 'Point', coordinates: [139.7671, 35.6811] } }),
      createPhoto({ id: 3, location: { type: 'Point', coordinates: [139.7672, 35.6812] } })
    ];
    const index = buildPhotoClusterIndex(photos);

    const lowZoomResult = getVisiblePhotoClusters(index, WORLD_BBOX, 0);

    expect(lowZoomResult).toHaveLength(1);
    expect(lowZoomResult[0]).toMatchObject({ type: 'cluster', photoCount: 3 });
  });

  test('十分ズームインすると、クラスタが解けて個別の写真として返る', () => {
    const photos = [
      createPhoto({ id: 1, location: { type: 'Point', coordinates: [139.767, 35.681] } }),
      createPhoto({ id: 2, location: { type: 'Point', coordinates: [139.7671, 35.6811] } })
    ];
    const index = buildPhotoClusterIndex(photos);

    const result = getVisiblePhotoClusters(index, WORLD_BBOX, HIGH_ZOOM);

    expect(result.every((point) => point.type === 'single')).toBe(true);
    expect(result).toHaveLength(2);
  });

  test('写真が0件の場合、空配列を返す', () => {
    const index = buildPhotoClusterIndex([]);

    const result = getVisiblePhotoClusters(index, WORLD_BBOX, HIGH_ZOOM);

    expect(result).toEqual([]);
  });
});
