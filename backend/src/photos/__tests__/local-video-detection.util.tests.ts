import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { isLocalFileVideo } from '../local-video-detection.util';

describe('isLocalFileVideoに関するテスト（Issue #104）', () => {
  let directoryPath: string;

  beforeEach(() => {
    directoryPath = mkdtempSync(join(tmpdir(), 'local-video-detection-util-tests-'));
  });

  afterEach(() => {
    rmSync(directoryPath, { recursive: true, force: true });
  });

  test('拡張子が動画拡張子の場合、ファイルの中身を読まずに動画と判定する', () => {
    const filePath = join(directoryPath, 'VIDEO_1.mp4');
    writeFileSync(filePath, 'not-a-real-video-container');

    expect(isLocalFileVideo(filePath, 'VIDEO_1.mp4')).toBe(true);
  });

  test('拡張子が写真拡張子で中身も実際にJPEGの場合、写真と判定する', () => {
    const filePath = join(directoryPath, 'IMG_1.jpg');
    writeFileSync(filePath, Buffer.from([0xff, 0xd8, 0xff, 0xe0]));

    expect(isLocalFileVideo(filePath, 'IMG_1.jpg')).toBe(false);
  });

  test('拡張子が.movを失っている（拡張子なし）が、中身が実際にはHEIC以外のftypコンテナ（QuickTime動画）の場合、動画と判定する', () => {
    const filePath = join(directoryPath, 'IMG_1234');
    const quickTimeHeader = Buffer.concat([Buffer.from([0x00, 0x00, 0x00, 0x18]), Buffer.from('ftypqt  ', 'ascii')]);
    writeFileSync(filePath, quickTimeHeader);

    expect(isLocalFileVideo(filePath, 'IMG_1234')).toBe(true);
  });

  test('拡張子が.heicで中身も実際にHEICのftypコンテナの場合、動画とは判定しない', () => {
    const filePath = join(directoryPath, 'IMG_1.heic');
    const heicHeader = Buffer.concat([Buffer.from([0x00, 0x00, 0x00, 0x18]), Buffer.from('ftypheic', 'ascii')]);
    writeFileSync(filePath, heicHeader);

    expect(isLocalFileVideo(filePath, 'IMG_1.heic')).toBe(false);
  });

  test('中身の先頭バイトを確認するために、ファイル全体は読み込まず先頭の一部のみを読み込む', () => {
    const filePath = join(directoryPath, 'IMG_1');
    // ftypボックス自体はファイル先頭にあるが、それ以降に巨大なダミーデータが続く場合でも
    // 先頭の一部だけを読めば判定できることを確認する（動画は数GB級になりうるため全読み込みは避ける、Issue #104）
    const heicHeader = Buffer.concat([Buffer.from([0x00, 0x00, 0x00, 0x18]), Buffer.from('ftypheic', 'ascii')]);
    writeFileSync(filePath, Buffer.concat([heicHeader, Buffer.alloc(1024 * 1024, 0)]));

    expect(isLocalFileVideo(filePath, 'IMG_1')).toBe(false);
  });
});
