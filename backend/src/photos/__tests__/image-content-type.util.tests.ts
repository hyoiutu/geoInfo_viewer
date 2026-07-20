import { describe, expect, test } from 'vitest';
import { resolveImageContentType } from '../image-content-type.util';

describe('resolveImageContentTypeに関するテスト', () => {
  test.each([
    ['IMG_1234.jpg', 'image/jpeg'],
    ['IMG_1234.JPG', 'image/jpeg'],
    ['IMG_1234.jpeg', 'image/jpeg'],
    ['IMG_1234.png', 'image/png'],
    ['IMG_1234.gif', 'image/gif'],
    ['IMG_1234.heic', 'image/heic'],
    ['IMG_1234.webp', 'image/webp']
  ])('ファイル名%sの場合、%sを返す', (fileName, expected) => {
    expect(resolveImageContentType(fileName)).toBe(expected);
  });

  test('未知の拡張子の場合、application/octet-streamを返す', () => {
    expect(resolveImageContentType('IMG_1234.unknown')).toBe('application/octet-stream');
  });
});
