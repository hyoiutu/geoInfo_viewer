import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { assertHeifConvertAvailable, convertHeicBufferToJpegBuffer, isActualHeicFile } from '../heic-conversion.util';

vi.mock('node:child_process', () => ({ execFileSync: vi.fn() }));

describe('convertHeicBufferToJpegBufferに関するテスト', () => {
  const mockedExecFileSync = vi.mocked(execFileSync);

  beforeEach(() => {
    mockedExecFileSync.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('heif-convertを--disable-limitsオプション付きで呼び出し、生成されたJPEGファイルをバッファとして返す', () => {
    const fakeJpegContent = Buffer.from('fake jpeg content');
    let capturedOutputPath = '';
    mockedExecFileSync.mockImplementation((_command: string, args: readonly string[] | undefined) => {
      const commandArgs = args ?? [];
      const outputPath = commandArgs[commandArgs.length - 1];
      capturedOutputPath = outputPath;
      writeFileSync(outputPath, fakeJpegContent);
      return Buffer.from('');
    });

    const result = convertHeicBufferToJpegBuffer(Buffer.from('fake heic content'));

    expect(result.equals(fakeJpegContent)).toBe(true);
    expect(mockedExecFileSync).toHaveBeenCalledWith('heif-convert', [
      '--disable-limits',
      expect.stringMatching(/input\.heic$/),
      expect.stringMatching(/output\.jpg$/)
    ]);
    // 変換後は作業ディレクトリ(一時ファイル含む)を削除する
    expect(existsSync(capturedOutputPath)).toBe(false);
  });

  test('heif-convertの実行に失敗した場合、エラーを投げつつ作業ディレクトリを削除する', () => {
    let capturedInputPath = '';
    mockedExecFileSync.mockImplementation((_command: string, args: readonly string[] | undefined) => {
      const commandArgs = args ?? [];
      capturedInputPath = commandArgs[commandArgs.length - 2];
      throw new Error('heif-convert failed: unsupported codec');
    });

    expect(() => convertHeicBufferToJpegBuffer(Buffer.from('fake heic content'))).toThrow(
      'heif-convert failed: unsupported codec'
    );
    expect(existsSync(capturedInputPath)).toBe(false);
  });
});

describe('assertHeifConvertAvailableに関するテスト', () => {
  const mockedExecFileSync = vi.mocked(execFileSync);

  beforeEach(() => {
    mockedExecFileSync.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('heif-convertが--disable-limitsオプションに対応している場合、エラーを投げない', () => {
    // heif-convertは--helpを指定してもexit code 1で終了するため、execFileSyncは例外を投げるが
    // 標準出力自体には正常にヘルプテキストが含まれる（実際の挙動を再現）
    mockedExecFileSync.mockImplementation(() => {
      throw Object.assign(new Error('Command failed'), {
        stdout: Buffer.from('Usage: heif-convert [options]\n      --disable-limits   disable all security limits')
      });
    });

    expect(() => assertHeifConvertAvailable()).not.toThrow();
  });

  test('heif-convertコマンドが見つからない(ENOENT)場合、エラーを投げる', () => {
    mockedExecFileSync.mockImplementation(() => {
      throw Object.assign(new Error('spawnSync heif-convert ENOENT'), { code: 'ENOENT' });
    });

    expect(() => assertHeifConvertAvailable()).toThrow(/heif-convert/);
  });

  test('heif-convertが--disable-limitsオプションに対応していない(古いバージョン)場合、エラーを投げる', () => {
    mockedExecFileSync.mockImplementation(() => {
      throw Object.assign(new Error('Command failed'), {
        stdout: Buffer.from('Usage: heif-convert [options]\n  -q, --quality  quality')
      });
    });

    expect(() => assertHeifConvertAvailable()).toThrow(/disable-limits/);
  });
});

describe('isActualHeicFileに関するテスト（Issue #106）', () => {
  const createFakeHeicHeader = (): Buffer =>
    Buffer.concat([Buffer.from([0x00, 0x00, 0x00, 0x18]), Buffer.from('ftypheic', 'ascii')]);

  test('拡張子が.heic/.heifで中身も実際にISOBMFFのftypボックスから始まる場合、trueを返す', () => {
    const buffer = Buffer.concat([createFakeHeicHeader(), Buffer.from('dummy heic payload')]);

    expect(isActualHeicFile('IMG_1.heic', buffer)).toBe(true);
    expect(isActualHeicFile('IMG_1.HEIF', buffer)).toBe(true);
  });

  test('拡張子が.heic/.heifでも、中身が実際にはISOBMFFのftypボックスから始まっていない場合、falseを返す', () => {
    const buffer = Buffer.from('not a heic file, actually a jpeg after re-save');

    expect(isActualHeicFile('IMG_1.heic', buffer)).toBe(false);
  });

  test('拡張子が.heic/.heifでない場合、中身に関わらずfalseを返す', () => {
    const buffer = Buffer.concat([createFakeHeicHeader(), Buffer.from('dummy heic payload')]);

    expect(isActualHeicFile('IMG_1.jpg', buffer)).toBe(false);
  });
});
