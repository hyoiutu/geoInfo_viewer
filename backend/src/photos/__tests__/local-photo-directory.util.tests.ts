import { mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { createLazyPhotoData, readLocalPhotoData, scanLocalPhotoDirectory } from '../local-photo-directory.util';

describe('scanLocalPhotoDirectoryに関するテスト', () => {
  let directoryPath: string;

  beforeEach(() => {
    directoryPath = mkdtempSync(join(tmpdir(), 'local-photo-directory-util-tests-'));
  });

  afterEach(() => {
    rmSync(directoryPath, { recursive: true, force: true });
  });

  test('写真本体とJSONサイドカーファイルを分類する。JSONの中身は読み込み済み、写真は未読み込みのプレースホルダになる', () => {
    writeFileSync(join(directoryPath, 'IMG_1.jpg'), 'jpeg-binary');
    writeFileSync(join(directoryPath, 'IMG_1.jpg.json'), '{"photoTakenTime":{"timestamp":"1751328000"}}');

    const result = scanLocalPhotoDirectory(directoryPath);

    expect(result.photoEntries).toHaveLength(1);
    expect(result.photoEntries[0]?.path).toBe('IMG_1.jpg');
    expect(result.photoEntries[0]?.absolutePath).toBe(join(directoryPath, 'IMG_1.jpg'));
    expect(result.photoEntries[0]?.data).toEqual(Buffer.alloc(0));

    expect(result.jsonEntries).toHaveLength(1);
    expect(result.jsonEntries[0]?.path).toBe('IMG_1.jpg.json');
    expect(result.jsonEntries[0]?.data.toString('utf-8')).toBe('{"photoTakenTime":{"timestamp":"1751328000"}}');
  });

  test('サブディレクトリは対象外とする', () => {
    mkdtempSync(join(directoryPath, 'nested-'));
    writeFileSync(join(directoryPath, 'IMG_1.jpg'), 'jpeg-binary');

    const result = scanLocalPhotoDirectory(directoryPath);

    expect(result.photoEntries).toHaveLength(1);
  });

  test('JSON拡張子の大文字小文字を区別せずJSONサイドカーとして分類する', () => {
    writeFileSync(join(directoryPath, 'IMG_2.JPG.JSON'), '{}');

    const result = scanLocalPhotoDirectory(directoryPath);

    expect(result.jsonEntries).toHaveLength(1);
    expect(result.photoEntries).toHaveLength(0);
  });
});

describe('readLocalPhotoDataに関するテスト', () => {
  let directoryPath: string;

  beforeEach(() => {
    directoryPath = mkdtempSync(join(tmpdir(), 'local-photo-directory-util-tests-'));
  });

  afterEach(() => {
    rmSync(directoryPath, { recursive: true, force: true });
  });

  test('絶対パスから写真本体の実バイナリを読み込む', () => {
    writeFileSync(join(directoryPath, 'IMG_1.jpg'), 'jpeg-binary');
    const { photoEntries } = scanLocalPhotoDirectory(directoryPath);
    const entry = photoEntries[0];
    if (entry === undefined) {
      throw new Error('photoEntries[0] should exist');
    }

    const result = readLocalPhotoData(entry);

    expect(result.path).toBe('IMG_1.jpg');
    expect(result.data.toString('utf-8')).toBe('jpeg-binary');
  });
});

describe('createLazyPhotoDataに関するテスト', () => {
  let directoryPath: string;

  beforeEach(() => {
    directoryPath = mkdtempSync(join(tmpdir(), 'local-photo-directory-util-tests-'));
  });

  afterEach(() => {
    rmSync(directoryPath, { recursive: true, force: true });
  });

  test('dataへアクセスすると、絶対パスから実バイナリを遅延読み込みする', () => {
    writeFileSync(join(directoryPath, 'IMG_1.jpg'), 'jpeg-binary');
    const { photoEntries } = scanLocalPhotoDirectory(directoryPath);
    const entry = photoEntries[0];
    if (entry === undefined) {
      throw new Error('photoEntries[0] should exist');
    }

    const result = createLazyPhotoData(entry);

    expect(result.path).toBe('IMG_1.jpg');
    expect(result.data.toString('utf-8')).toBe('jpeg-binary');
  });

  test('dataへ一度もアクセスしなければ、ファイルの読み込みは行われない', () => {
    writeFileSync(join(directoryPath, 'IMG_1.jpg'), 'jpeg-binary');
    const { photoEntries } = scanLocalPhotoDirectory(directoryPath);
    const entry = photoEntries[0];
    if (entry === undefined) {
      throw new Error('photoEntries[0] should exist');
    }

    const result = createLazyPhotoData(entry);
    // dataへ一度もアクセスせず元ファイルを削除する。もし生成時点で読み込んでいれば
    // ここでの削除は無関係なはずで、dataへの遅延アクセスがまだ発生していないことの検証にはならないため、
    // 後続でdataへアクセスした際に読み込みエラーになることをもって遅延評価を確認する
    unlinkSync(join(directoryPath, 'IMG_1.jpg'));

    expect(() => result.data).toThrow();
  });
});
