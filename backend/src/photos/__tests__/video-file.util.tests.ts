import { describe, expect, test } from 'vitest';
import { isVideoFile } from '../video-file.util';

describe('isVideoFileに関するテスト', () => {
  test.each([
    ['IMG_1234.mp4', true],
    ['IMG_1234.MP4', true],
    ['IMG_1234.mov', true],
    ['IMG_1234.MOV', true],
    ['IMG_1234.avi', true],
    ['IMG_1234.mkv', true],
    ['IMG_1234.3gp', true],
    ['IMG_1234.webm', true],
    ['MAH00074.m4v', true],
    ['IMG_1234.jpg', false],
    ['IMG_1234.jpeg', false],
    ['IMG_1234.png', false],
    ['IMG_1234.heic', false],
    ['IMG_1234.json', false]
  ])('ファイル名%sの場合、%sを返す', (fileName, expected) => {
    expect(isVideoFile(fileName)).toBe(expected);
  });
});
