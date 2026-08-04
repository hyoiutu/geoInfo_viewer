import { renderHook } from '@testing-library/react';
import type maplibregl from 'maplibre-gl';
import { describe, expect, test, vi } from 'vitest';
import type { Photo } from '../../api/activitiesApi';
import * as mapLayerInteraction from '../../utils/mapLayerInteraction';
import * as photoBalloonCluster from '../../utils/photoBalloonCluster.util';
import { usePhotoBalloons } from '../usePhotoBalloons';

const PHOTO: Photo = { id: 1, fileName: 'a.jpg', takenAt: '2026-07-01T00:30:00.000Z', location: null };
// テスト対象はクラスタインデックスの中身を解釈せずbuildPhotoClusterIndex/applyPhotoBalloons間で
// そのまま受け渡すだけのため、実体を必要としないダミーオブジェクトへキャストする
const CLUSTER_INDEX: photoBalloonCluster.PhotoClusterIndex = {} as never;

const createMockMap = () => {
  const moveEndHandlers: (() => void)[] = [];
  const on = vi.fn((event: string, handler: () => void) => {
    if (event === 'moveend') {
      moveEndHandlers.push(handler);
    }
  });
  // テスト対象はmap.onのみ呼ぶため、必要最小限のモックへキャストする
  const asMap = (mock: object): maplibregl.Map => mock as never;
  const map = asMap({ on });
  return {
    map,
    on,
    triggerMoveEnd: () => {
      for (const handler of moveEndHandlers) {
        handler();
      }
    }
  };
};

describe('usePhotoBalloonsに関するテスト（Issue #127）', () => {
  test('mapがnullの場合、applyPhotoBalloons・map.onのいずれも呼ばれない', () => {
    const applySpy = vi.spyOn(mapLayerInteraction, 'applyPhotoBalloons').mockImplementation(() => {});
    const mapRef = { current: null };

    renderHook(() => usePhotoBalloons(mapRef, [], true, vi.fn()));

    expect(applySpy).not.toHaveBeenCalled();
    applySpy.mockRestore();
  });

  test('isStyleLoadedがfalseの場合、applyPhotoBalloons・map.onのいずれも呼ばれない', () => {
    const applySpy = vi.spyOn(mapLayerInteraction, 'applyPhotoBalloons').mockImplementation(() => {});
    const { map, on } = createMockMap();
    const mapRef = { current: map };

    renderHook(() => usePhotoBalloons(mapRef, [], false, vi.fn()));

    expect(applySpy).not.toHaveBeenCalled();
    expect(on).not.toHaveBeenCalled();
    applySpy.mockRestore();
  });

  test('条件が揃っている場合、buildPhotoClusterIndexにphotosを渡して呼ばれ、applyPhotoBalloonsが呼ばれる', () => {
    const applySpy = vi.spyOn(mapLayerInteraction, 'applyPhotoBalloons').mockImplementation(() => {});
    const buildSpy = vi.spyOn(photoBalloonCluster, 'buildPhotoClusterIndex').mockReturnValue(CLUSTER_INDEX);
    const { map } = createMockMap();
    const mapRef = { current: map };
    const photos = [PHOTO];

    renderHook(() => usePhotoBalloons(mapRef, photos, true, vi.fn()));

    expect(buildSpy).toHaveBeenCalledWith(photos);
    expect(applySpy).toHaveBeenCalledWith(map, expect.anything(), CLUSTER_INDEX, expect.any(Function));
    applySpy.mockRestore();
    buildSpy.mockRestore();
  });

  test('地図の移動(moveend)が発生すると、直近のクラスタインデックスでapplyPhotoBalloonsが再度呼ばれる', () => {
    const applySpy = vi.spyOn(mapLayerInteraction, 'applyPhotoBalloons').mockImplementation(() => {});
    vi.spyOn(photoBalloonCluster, 'buildPhotoClusterIndex').mockReturnValue(CLUSTER_INDEX);
    const { map, triggerMoveEnd } = createMockMap();
    const mapRef = { current: map };

    renderHook(() => usePhotoBalloons(mapRef, [PHOTO], true, vi.fn()));
    applySpy.mockClear();

    triggerMoveEnd();

    expect(applySpy).toHaveBeenCalledWith(map, expect.anything(), CLUSTER_INDEX, expect.any(Function));
    vi.restoreAllMocks();
  });

  test('photosが変化すると、buildPhotoClusterIndex・applyPhotoBalloonsが再度呼ばれる', () => {
    const applySpy = vi.spyOn(mapLayerInteraction, 'applyPhotoBalloons').mockImplementation(() => {});
    const buildSpy = vi.spyOn(photoBalloonCluster, 'buildPhotoClusterIndex').mockReturnValue(CLUSTER_INDEX);
    const { map } = createMockMap();
    const mapRef = { current: map };
    const { rerender } = renderHook(({ photos }) => usePhotoBalloons(mapRef, photos, true, vi.fn()), {
      initialProps: { photos: [PHOTO] }
    });
    buildSpy.mockClear();
    applySpy.mockClear();

    rerender({ photos: [] });

    expect(buildSpy).toHaveBeenCalledWith([]);
    expect(applySpy).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
  });

  test('渡されたonPhotoClickは、登録されたコールバック経由で呼ばれる', () => {
    const applySpy = vi.spyOn(mapLayerInteraction, 'applyPhotoBalloons').mockImplementation(() => {});
    vi.spyOn(photoBalloonCluster, 'buildPhotoClusterIndex').mockReturnValue(CLUSTER_INDEX);
    const { map } = createMockMap();
    const mapRef = { current: map };
    const onPhotoClick = vi.fn();

    renderHook(() => usePhotoBalloons(mapRef, [PHOTO], true, onPhotoClick));
    const [, , , registeredOnPhotoClick] = applySpy.mock.calls[0] ?? [];
    registeredOnPhotoClick?.(1);

    expect(onPhotoClick).toHaveBeenCalledWith(1);
    vi.restoreAllMocks();
  });
});
