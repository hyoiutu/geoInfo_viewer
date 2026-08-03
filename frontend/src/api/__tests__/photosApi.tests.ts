import { describe, expect, test } from 'vitest';
import { resolvePhotoImageUrl, resolvePhotoThumbnailUrl } from '../photosApi';

describe('resolvePhotoImageUrlに関するテスト', () => {
  test('指定した写真IDの画像取得用URLを組み立てる', () => {
    const url = resolvePhotoImageUrl(42);

    expect(url).toBe('http://localhost:3000/photos/42/image');
  });
});

describe('resolvePhotoThumbnailUrlに関するテスト（Issue #105）', () => {
  test('指定した写真IDのサムネイル取得用URLを組み立てる', () => {
    const url = resolvePhotoThumbnailUrl(42);

    expect(url).toBe('http://localhost:3000/photos/42/thumbnail');
  });
});
