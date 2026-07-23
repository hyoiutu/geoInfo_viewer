import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { flattenPhotoDirectory } from '../flatten-local-photo-directory';

describe('flattenPhotoDirectoryに関するテスト', () => {
  let inputDirectoryPath: string;
  let outputDirectoryPath: string;

  beforeEach(() => {
    const rootDirectoryPath = mkdtempSync(join(tmpdir(), 'flatten-local-photo-directory-tests-'));
    inputDirectoryPath = join(rootDirectoryPath, 'input');
    outputDirectoryPath = join(rootDirectoryPath, 'output');
    mkdirSync(inputDirectoryPath, { recursive: true });
  });

  afterEach(() => {
    rmSync(inputDirectoryPath, { recursive: true, force: true });
    rmSync(outputDirectoryPath, { recursive: true, force: true });
  });

  test('ネストしたディレクトリ内の全ファイルを、フラットな出力ディレクトリへコピーする', async () => {
    const albumDirectoryPath = join(inputDirectoryPath, 'Google Photos', 'Album A');
    mkdirSync(albumDirectoryPath, { recursive: true });
    writeFileSync(join(albumDirectoryPath, 'IMG_1.jpg'), 'jpeg-binary-1');
    writeFileSync(join(albumDirectoryPath, 'IMG_1.jpg.json'), '{"a":1}');

    const result = await flattenPhotoDirectory(inputDirectoryPath, outputDirectoryPath);

    expect(readdirSync(outputDirectoryPath).sort()).toEqual(['IMG_1.jpg', 'IMG_1.jpg.json']);
    expect(readFileSync(join(outputDirectoryPath, 'IMG_1.jpg'), 'utf-8')).toBe('jpeg-binary-1');
    expect(result).toEqual({ copiedCount: 2, skippedDuplicateCount: 0 });
  });

  test('複数フォルダに同名・同内容のファイルが重複している場合、1件に集約しコピーはスキップされる', async () => {
    const albumOneDirectoryPath = join(inputDirectoryPath, 'Album A');
    const albumTwoDirectoryPath = join(inputDirectoryPath, 'Album B');
    mkdirSync(albumOneDirectoryPath, { recursive: true });
    mkdirSync(albumTwoDirectoryPath, { recursive: true });
    writeFileSync(join(albumOneDirectoryPath, 'IMG_1.jpg'), 'same-content');
    writeFileSync(join(albumTwoDirectoryPath, 'IMG_1.jpg'), 'same-content');

    const result = await flattenPhotoDirectory(inputDirectoryPath, outputDirectoryPath);

    expect(readdirSync(outputDirectoryPath)).toEqual(['IMG_1.jpg']);
    expect(result).toEqual({ copiedCount: 1, skippedDuplicateCount: 1 });
  });

  test('同名だが内容が異なるファイルは、連番を付けて別ファイルとして保存する', async () => {
    const albumOneDirectoryPath = join(inputDirectoryPath, 'Album A');
    const albumTwoDirectoryPath = join(inputDirectoryPath, 'Album B');
    mkdirSync(albumOneDirectoryPath, { recursive: true });
    mkdirSync(albumTwoDirectoryPath, { recursive: true });
    writeFileSync(join(albumOneDirectoryPath, 'IMG_1.jpg'), 'content-a');
    writeFileSync(join(albumTwoDirectoryPath, 'IMG_1.jpg'), 'content-b');

    const result = await flattenPhotoDirectory(inputDirectoryPath, outputDirectoryPath);

    expect(readdirSync(outputDirectoryPath).sort()).toEqual(['IMG_1-2.jpg', 'IMG_1.jpg']);
    expect(result).toEqual({ copiedCount: 2, skippedDuplicateCount: 0 });
  });

  test('コピー元のファイル・ディレクトリ構造は変更されない', async () => {
    const albumDirectoryPath = join(inputDirectoryPath, 'Album A');
    mkdirSync(albumDirectoryPath, { recursive: true });
    writeFileSync(join(albumDirectoryPath, 'IMG_1.jpg'), 'jpeg-binary-1');

    await flattenPhotoDirectory(inputDirectoryPath, outputDirectoryPath);

    expect(readdirSync(albumDirectoryPath)).toEqual(['IMG_1.jpg']);
  });
});
