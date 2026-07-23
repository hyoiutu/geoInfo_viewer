import { describe, expect, test } from 'vitest';
import { resolvePhotoImageUrl } from '../photosApi';

describe('resolvePhotoImageUrlに関するテスト', () => {
  test('指定した写真IDの画像取得用URLを組み立てる', () => {
    const url = resolvePhotoImageUrl(42);

    expect(url).toBe('http://localhost:3000/photos/42/image');
  });
});
