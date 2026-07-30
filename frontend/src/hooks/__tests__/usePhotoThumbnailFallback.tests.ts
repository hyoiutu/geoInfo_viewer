import { act, renderHook } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { resolvePhotoImageUrl, resolvePhotoThumbnailUrl } from '../../api/photosApi';
import { usePhotoThumbnailFallback } from '../usePhotoThumbnailFallback';

describe('usePhotoThumbnailFallbackに関するテスト（Issue #107）', () => {
  test('初期状態ではサムネイルURLを返し、isLoadedはfalse', () => {
    const { result } = renderHook(() => usePhotoThumbnailFallback(1));

    expect(result.current.src).toBe(resolvePhotoThumbnailUrl(1));
    expect(result.current.isLoaded).toBe(false);
  });

  test('handleLoadを呼ぶとisLoadedがtrueになる', () => {
    const { result } = renderHook(() => usePhotoThumbnailFallback(1));

    act(() => {
      result.current.handleLoad();
    });

    expect(result.current.isLoaded).toBe(true);
  });

  test('handleErrorを1度呼ぶと、フルサイズ画像のURLへ切り替わりisLoadedはfalseのまま', () => {
    const { result } = renderHook(() => usePhotoThumbnailFallback(1));

    act(() => {
      result.current.handleError();
    });

    expect(result.current.src).toBe(resolvePhotoImageUrl(1));
    expect(result.current.isLoaded).toBe(false);
  });

  test('handleErrorを2度呼ぶ（フルサイズも失敗）と、isLoadedがtrueになり諦める', () => {
    const { result } = renderHook(() => usePhotoThumbnailFallback(1));

    act(() => {
      result.current.handleError();
    });
    act(() => {
      result.current.handleError();
    });

    expect(result.current.isLoaded).toBe(true);
  });
});
