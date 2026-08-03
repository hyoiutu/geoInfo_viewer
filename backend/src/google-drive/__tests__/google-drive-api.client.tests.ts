// biome-ignore-all lint/style/useNamingConvention: Google APIレスポンス形式(snake_case)に合わせたテストダブル
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { HttpService } from '@nestjs/axios';
import { Test } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { APP_ERROR_CODE } from '../../common/errors/app-error-code.constants';
import { assertIsAppException } from '../../test-utils/assert-is-app-exception';
import { GoogleDriveApiClient, UPLOAD_RETRY_MAX_ATTEMPTS } from '../google-drive-api.client';
import type { GoogleDriveFileMetadata } from '../types/google-drive.type';

const createFileMetadata = (overrides: Partial<GoogleDriveFileMetadata>): GoogleDriveFileMetadata => ({
  id: 'file-1',
  name: 'takeout.zip',
  mimeType: 'application/zip',
  size: '1024',
  ...overrides
});

describe('GoogleDriveApiClientに関するテスト', () => {
  const createClient = async (
    httpServiceGet: ReturnType<typeof vi.fn>,
    httpServicePost: ReturnType<typeof vi.fn>,
    httpServicePatch: ReturnType<typeof vi.fn> = vi.fn(),
    httpServicePut: ReturnType<typeof vi.fn> = vi.fn(),
    httpServiceDelete: ReturnType<typeof vi.fn> = vi.fn()
  ) => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        GoogleDriveApiClient,
        {
          provide: HttpService,
          useValue: {
            get: httpServiceGet,
            post: httpServicePost,
            patch: httpServicePatch,
            put: httpServicePut,
            delete: httpServiceDelete
          }
        }
      ]
    }).compile();

    return moduleRef.get(GoogleDriveApiClient);
  };

  describe('getFileMetadata', () => {
    test('アクセストークンをAuthorizationヘッダーに含め、レスポンスのdataをそのまま返す', async () => {
      const metadata = createFileMetadata({ id: 'file-1' });
      const httpServiceGet = vi.fn().mockReturnValue(of({ data: metadata }));
      const client = await createClient(httpServiceGet, vi.fn());

      const result = await client.getFileMetadata('token-xyz', 'file-1');

      expect(result).toEqual(metadata);
      expect(httpServiceGet).toHaveBeenCalledWith(
        expect.stringContaining('/files/file-1'),
        expect.objectContaining({ headers: { Authorization: 'Bearer token-xyz' }, timeout: expect.any(Number) })
      );
    });

    test('失敗した場合、errorCode: GOOGLE_DRIVE_API_ERRORのAppExceptionを投げる', async () => {
      const httpServiceGet = vi
        .fn()
        .mockReturnValue(throwError(() => ({ isAxiosError: true, response: { status: 500 } })));
      const client = await createClient(httpServiceGet, vi.fn());

      try {
        await client.getFileMetadata('token-xyz', 'file-1');
        expect.unreachable('例外が投げられるはず');
      } catch (error) {
        assertIsAppException(error);
        expect(error.getResponse()).toEqual(expect.objectContaining({ errorCode: APP_ERROR_CODE.googleDriveApiError }));
      }
    });

    test('存在しないファイルの場合、errorCode: GOOGLE_DRIVE_FILE_NOT_FOUNDのAppExceptionを投げる(404)', async () => {
      const httpServiceGet = vi
        .fn()
        .mockReturnValue(throwError(() => ({ isAxiosError: true, response: { status: 404 } })));
      const client = await createClient(httpServiceGet, vi.fn());

      try {
        await client.getFileMetadata('token-xyz', 'missing-file');
        expect.unreachable('例外が投げられるはず');
      } catch (error) {
        assertIsAppException(error);
        expect(error.getResponse()).toEqual(
          expect.objectContaining({ errorCode: APP_ERROR_CODE.googleDriveFileNotFound })
        );
      }
    });
  });

  describe('downloadFile', () => {
    test('アクセストークンをAuthorizationヘッダーに含め、レスポンスのdataをBufferとして返す', async () => {
      const binary = Buffer.from('zip-content');
      const httpServiceGet = vi.fn().mockReturnValue(of({ data: binary }));
      const client = await createClient(httpServiceGet, vi.fn());

      const result = await client.downloadFile('token-xyz', 'file-1');

      expect(result).toEqual(binary);
      expect(httpServiceGet).toHaveBeenCalledWith(
        expect.stringContaining('/files/file-1'),
        expect.objectContaining({
          headers: { Authorization: 'Bearer token-xyz' },
          params: { alt: 'media' },
          responseType: 'arraybuffer',
          timeout: expect.any(Number)
        })
      );
    });

    test('失敗した場合、errorCode: GOOGLE_DRIVE_API_ERRORのAppExceptionを投げる', async () => {
      const httpServiceGet = vi.fn().mockReturnValue(throwError(() => new Error('network error')));
      const client = await createClient(httpServiceGet, vi.fn());

      try {
        await client.downloadFile('token-xyz', 'file-1');
        expect.unreachable('例外が投げられるはず');
      } catch (error) {
        assertIsAppException(error);
        expect(error.getResponse()).toEqual(expect.objectContaining({ errorCode: APP_ERROR_CODE.googleDriveApiError }));
      }
    });
  });

  describe('createFileMetadata', () => {
    test('アクセストークンをAuthorizationヘッダーに含め、ファイル名をボディに指定してPOSTし、作成したファイルのIDを返す', async () => {
      const httpServicePost = vi.fn().mockReturnValue(of({ data: createFileMetadata({ id: 'new-file-1' }) }));
      const client = await createClient(vi.fn(), httpServicePost);

      const result = await client.createFileMetadata('token-xyz', '2026-07.zip');

      expect(result).toBe('new-file-1');
      expect(httpServicePost).toHaveBeenCalledWith(
        expect.any(String),
        { name: '2026-07.zip' },
        expect.objectContaining({ headers: { Authorization: 'Bearer token-xyz' }, timeout: expect.any(Number) })
      );
    });

    test('失敗した場合、errorCode: GOOGLE_DRIVE_API_ERRORのAppExceptionを投げる', async () => {
      const httpServicePost = vi
        .fn()
        .mockReturnValue(throwError(() => ({ isAxiosError: true, response: { status: 500 } })));
      const client = await createClient(vi.fn(), httpServicePost);

      try {
        await client.createFileMetadata('token-xyz', '2026-07.zip');
        expect.unreachable('例外が投げられるはず');
      } catch (error) {
        assertIsAppException(error);
        expect(error.getResponse()).toEqual(expect.objectContaining({ errorCode: APP_ERROR_CODE.googleDriveApiError }));
      }
    });
  });

  describe('updateFileContent', () => {
    test('レジューマブルアップロードのセッションを開始し、内容がチャンクサイズ以下の場合は1回のPUTで送信する', async () => {
      const httpServicePatch = vi
        .fn()
        .mockReturnValue(of({ headers: { location: 'https://upload.example/session-1' } }));
      const httpServicePut = vi.fn().mockReturnValue(of({ data: createFileMetadata({ id: 'file-1' }) }));
      const client = await createClient(vi.fn(), vi.fn(), httpServicePatch, httpServicePut);
      const content = Buffer.from('zip-content');

      await client.updateFileContent('token-xyz', 'file-1', content);

      expect(httpServicePatch).toHaveBeenCalledWith(
        expect.stringContaining('/files/file-1'),
        {},
        {
          headers: {
            Authorization: 'Bearer token-xyz',
            'Content-Type': 'application/json; charset=UTF-8',
            'X-Upload-Content-Type': 'application/zip',
            'X-Upload-Content-Length': String(content.length)
          },
          params: { uploadType: 'resumable' },
          timeout: expect.any(Number)
        }
      );
      expect(httpServicePut).toHaveBeenCalledTimes(1);
      expect(httpServicePut).toHaveBeenCalledWith('https://upload.example/session-1', content, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Range': `bytes 0-${content.length - 1}/${content.length}`
        },
        maxRedirects: 0,
        validateStatus: expect.any(Function),
        timeout: expect.any(Number)
      });
    });

    test('内容がチャンクサイズを超える場合、複数回に分けてPUTする（中間チャンクは308を正常応答として扱う）', async () => {
      const httpServicePatch = vi
        .fn()
        .mockReturnValue(of({ headers: { location: 'https://upload.example/session-1' } }));
      const httpServicePut = vi
        .fn()
        .mockReturnValueOnce(of({ status: 308, data: undefined }))
        .mockReturnValueOnce(of({ status: 200, data: createFileMetadata({ id: 'file-1' }) }));
      const client = await createClient(vi.fn(), vi.fn(), httpServicePatch, httpServicePut);
      // テストでは巨大バッファでのアサーション失敗時のOOMを避けるため、chunkSizeBytesを小さい値に差し替える
      const testChunkSizeBytes = 4;
      const content = Buffer.from('abcde');

      await client.updateFileContent('token-xyz', 'file-1', content, testChunkSizeBytes);

      expect(httpServicePut).toHaveBeenCalledTimes(2);
      expect(httpServicePut).toHaveBeenNthCalledWith(
        1,
        'https://upload.example/session-1',
        content.subarray(0, testChunkSizeBytes),
        {
          headers: {
            'Content-Type': 'application/zip',
            'Content-Range': `bytes 0-${testChunkSizeBytes - 1}/${content.length}`
          },
          maxRedirects: 0,
          validateStatus: expect.any(Function),
          timeout: expect.any(Number)
        }
      );
      expect(httpServicePut).toHaveBeenNthCalledWith(
        2,
        'https://upload.example/session-1',
        content.subarray(testChunkSizeBytes),
        {
          headers: {
            'Content-Type': 'application/zip',
            'Content-Range': `bytes ${testChunkSizeBytes}-${content.length - 1}/${content.length}`
          },
          maxRedirects: 0,
          validateStatus: expect.any(Function),
          timeout: expect.any(Number)
        }
      );
    });

    test('セッション開始が失敗した場合、errorCode: GOOGLE_DRIVE_API_ERRORのAppExceptionを投げる', async () => {
      const httpServicePatch = vi
        .fn()
        .mockReturnValue(throwError(() => ({ isAxiosError: true, response: { status: 500 } })));
      const client = await createClient(vi.fn(), vi.fn(), httpServicePatch);

      try {
        await client.updateFileContent('token-xyz', 'file-1', Buffer.from('zip-content'));
        expect.unreachable('例外が投げられるはず');
      } catch (error) {
        assertIsAppException(error);
        expect(error.getResponse()).toEqual(expect.objectContaining({ errorCode: APP_ERROR_CODE.googleDriveApiError }));
      }
    });

    test('コンテンツのPUTが失敗した場合、errorCode: GOOGLE_DRIVE_API_ERRORのAppExceptionを投げる', async () => {
      const httpServicePatch = vi
        .fn()
        .mockReturnValue(of({ headers: { location: 'https://upload.example/session-1' } }));
      const httpServicePut = vi
        .fn()
        .mockReturnValue(throwError(() => ({ isAxiosError: true, response: { status: 502 } })));
      const client = await createClient(vi.fn(), vi.fn(), httpServicePatch, httpServicePut);

      try {
        await client.updateFileContent('token-xyz', 'file-1', Buffer.from('zip-content'));
        expect.unreachable('例外が投げられるはず');
      } catch (error) {
        assertIsAppException(error);
        expect(error.getResponse()).toEqual(expect.objectContaining({ errorCode: APP_ERROR_CODE.googleDriveApiError }));
      }
    });

    test('セッション開始が一時的な接続エラー(EPIPE等、レスポンス無し)で失敗した場合、再試行して成功する', async () => {
      const httpServicePatch = vi
        .fn()
        .mockReturnValueOnce(throwError(() => ({ isAxiosError: true, code: 'EPIPE' })))
        .mockReturnValueOnce(of({ headers: { location: 'https://upload.example/session-1' } }));
      const httpServicePut = vi.fn().mockReturnValue(of({ data: createFileMetadata({ id: 'file-1' }) }));
      const client = await createClient(vi.fn(), vi.fn(), httpServicePatch, httpServicePut);

      await client.updateFileContent('token-xyz', 'file-1', Buffer.from('zip-content'), undefined, 0);

      expect(httpServicePatch).toHaveBeenCalledTimes(2);
      expect(httpServicePut).toHaveBeenCalledTimes(1);
    });

    test('接続エラーがUPLOAD_RETRY_MAX_ATTEMPTS回続けて発生した場合、再試行を打ち切りAppExceptionを投げる', async () => {
      const httpServicePatch = vi.fn().mockReturnValue(throwError(() => ({ isAxiosError: true, code: 'ECONNRESET' })));
      const client = await createClient(vi.fn(), vi.fn(), httpServicePatch);

      try {
        await client.updateFileContent('token-xyz', 'file-1', Buffer.from('zip-content'), undefined, 0);
        expect.unreachable('例外が投げられるはず');
      } catch (error) {
        assertIsAppException(error);
        expect(error.getResponse()).toEqual(expect.objectContaining({ errorCode: APP_ERROR_CODE.googleDriveApiError }));
      }
      expect(httpServicePatch).toHaveBeenCalledTimes(UPLOAD_RETRY_MAX_ATTEMPTS);
    });
  });

  describe('downloadFileToPath', () => {
    let dir: string;

    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), 'google-drive-download-test-'));
    });

    afterEach(() => {
      rmSync(dir, { recursive: true, force: true });
    });

    test('アクセストークンをAuthorizationヘッダーに含めstream形式でダウンロードし、指定パスへ書き込む', async () => {
      const httpServiceGet = vi.fn().mockReturnValue(of({ data: Readable.from([Buffer.from('zip-content')]) }));
      const client = await createClient(httpServiceGet, vi.fn());
      const destPath = join(dir, 'downloaded.zip');

      await client.downloadFileToPath('token-xyz', 'file-1', destPath);

      expect(readFileSync(destPath).toString()).toBe('zip-content');
      expect(httpServiceGet).toHaveBeenCalledWith(
        expect.stringContaining('/files/file-1'),
        expect.objectContaining({
          headers: { Authorization: 'Bearer token-xyz' },
          params: { alt: 'media' },
          responseType: 'stream',
          timeout: expect.any(Number)
        })
      );
    });

    test('レスポンスのContent-Lengthと実際に書き込んだバイト数が一致する場合は正常に完了する', async () => {
      const content = Buffer.from('zip-content');
      const httpServiceGet = vi
        .fn()
        .mockReturnValue(of({ data: Readable.from([content]), headers: { 'content-length': String(content.length) } }));
      const client = await createClient(httpServiceGet, vi.fn());
      const destPath = join(dir, 'downloaded.zip');

      await expect(client.downloadFileToPath('token-xyz', 'file-1', destPath)).resolves.toBeUndefined();
      expect(readFileSync(destPath).toString()).toBe('zip-content');
    });

    test('レスポンスのContent-Lengthより実際に書き込んだバイト数が少ない場合（ダウンロード途中で打ち切られた場合）、errorCode: GOOGLE_DRIVE_API_ERRORのAppExceptionを投げる', async () => {
      const truncatedContent = Buffer.from('zip-cont');
      const httpServiceGet = vi
        .fn()
        .mockReturnValue(of({ data: Readable.from([truncatedContent]), headers: { 'content-length': '12' } }));
      const client = await createClient(httpServiceGet, vi.fn());
      const destPath = join(dir, 'downloaded.zip');

      try {
        await client.downloadFileToPath('token-xyz', 'file-1', destPath);
        expect.unreachable('例外が投げられるはず');
      } catch (error) {
        assertIsAppException(error);
        expect(error.getResponse()).toEqual(expect.objectContaining({ errorCode: APP_ERROR_CODE.googleDriveApiError }));
      }
    });

    test('失敗した場合、errorCode: GOOGLE_DRIVE_API_ERRORのAppExceptionを投げる', async () => {
      const httpServiceGet = vi.fn().mockReturnValue(throwError(() => new Error('network error')));
      const client = await createClient(httpServiceGet, vi.fn());
      const destPath = join(dir, 'downloaded.zip');

      try {
        await client.downloadFileToPath('token-xyz', 'file-1', destPath);
        expect.unreachable('例外が投げられるはず');
      } catch (error) {
        assertIsAppException(error);
        expect(error.getResponse()).toEqual(expect.objectContaining({ errorCode: APP_ERROR_CODE.googleDriveApiError }));
      }
    });
  });

  describe('uploadFileFromPath', () => {
    let dir: string;

    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), 'google-drive-upload-test-'));
    });

    afterEach(() => {
      rmSync(dir, { recursive: true, force: true });
    });

    test('レジューマブルアップロードのセッションを開始し、ファイルサイズを事前に指定して送信する', async () => {
      const httpServicePatch = vi
        .fn()
        .mockReturnValue(of({ headers: { location: 'https://upload.example/session-1' } }));
      const httpServicePut = vi.fn().mockReturnValue(of({ data: createFileMetadata({ id: 'file-1' }) }));
      const client = await createClient(vi.fn(), vi.fn(), httpServicePatch, httpServicePut);
      const sourcePath = join(dir, 'source.zip');
      writeFileSync(sourcePath, Buffer.from('zip-content'));

      await client.uploadFileFromPath('token-xyz', 'file-1', sourcePath);

      expect(httpServicePatch).toHaveBeenCalledWith(
        expect.stringContaining('/files/file-1'),
        {},
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Upload-Content-Length': String(Buffer.from('zip-content').length)
          })
        })
      );
      expect(httpServicePut).toHaveBeenCalledTimes(1);
      expect(httpServicePut).toHaveBeenCalledWith('https://upload.example/session-1', Buffer.from('zip-content'), {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Range': `bytes 0-${Buffer.from('zip-content').length - 1}/${Buffer.from('zip-content').length}`
        },
        maxRedirects: 0,
        validateStatus: expect.any(Function),
        timeout: expect.any(Number)
      });
    });

    test('ファイルサイズがチャンクサイズを超える場合、ディスクから逐次読み込みながら複数回に分けてPUTする', async () => {
      const httpServicePatch = vi
        .fn()
        .mockReturnValue(of({ headers: { location: 'https://upload.example/session-1' } }));
      const httpServicePut = vi
        .fn()
        .mockReturnValueOnce(of({ status: 308, data: undefined }))
        .mockReturnValueOnce(of({ status: 200, data: createFileMetadata({ id: 'file-1' }) }));
      const client = await createClient(vi.fn(), vi.fn(), httpServicePatch, httpServicePut);
      const sourcePath = join(dir, 'source.zip');
      const content = Buffer.from('abcde');
      writeFileSync(sourcePath, content);
      const testChunkSizeBytes = 4;

      await client.uploadFileFromPath('token-xyz', 'file-1', sourcePath, testChunkSizeBytes);

      expect(httpServicePut).toHaveBeenCalledTimes(2);
      expect(httpServicePut).toHaveBeenNthCalledWith(
        1,
        'https://upload.example/session-1',
        content.subarray(0, testChunkSizeBytes),
        {
          headers: {
            'Content-Type': 'application/zip',
            'Content-Range': `bytes 0-${testChunkSizeBytes - 1}/${content.length}`
          },
          maxRedirects: 0,
          validateStatus: expect.any(Function),
          timeout: expect.any(Number)
        }
      );
      expect(httpServicePut).toHaveBeenNthCalledWith(
        2,
        'https://upload.example/session-1',
        content.subarray(testChunkSizeBytes),
        {
          headers: {
            'Content-Type': 'application/zip',
            'Content-Range': `bytes ${testChunkSizeBytes}-${content.length - 1}/${content.length}`
          },
          maxRedirects: 0,
          validateStatus: expect.any(Function),
          timeout: expect.any(Number)
        }
      );
    });

    test('セッション開始が失敗した場合、errorCode: GOOGLE_DRIVE_API_ERRORのAppExceptionを投げる', async () => {
      const httpServicePatch = vi
        .fn()
        .mockReturnValue(throwError(() => ({ isAxiosError: true, response: { status: 500 } })));
      const client = await createClient(vi.fn(), vi.fn(), httpServicePatch);
      const sourcePath = join(dir, 'source.zip');
      writeFileSync(sourcePath, Buffer.from('zip-content'));

      try {
        await client.uploadFileFromPath('token-xyz', 'file-1', sourcePath);
        expect.unreachable('例外が投げられるはず');
      } catch (error) {
        assertIsAppException(error);
        expect(error.getResponse()).toEqual(expect.objectContaining({ errorCode: APP_ERROR_CODE.googleDriveApiError }));
      }
    });

    test('セッション開始が一時的な接続エラー(EPIPE等、レスポンス無し)で失敗した場合、再試行して成功する（Issue #106フォローアップ）', async () => {
      const httpServicePatch = vi
        .fn()
        .mockReturnValueOnce(throwError(() => ({ isAxiosError: true, code: 'EPIPE' })))
        .mockReturnValueOnce(of({ headers: { location: 'https://upload.example/session-1' } }));
      const httpServicePut = vi.fn().mockReturnValue(of({ data: createFileMetadata({ id: 'file-1' }) }));
      const client = await createClient(vi.fn(), vi.fn(), httpServicePatch, httpServicePut);
      const sourcePath = join(dir, 'source.zip');
      writeFileSync(sourcePath, Buffer.from('zip-content'));

      await client.uploadFileFromPath('token-xyz', 'file-1', sourcePath, undefined, 0);

      expect(httpServicePatch).toHaveBeenCalledTimes(2);
      expect(httpServicePut).toHaveBeenCalledTimes(1);
    });

    test('接続エラーがUPLOAD_RETRY_MAX_ATTEMPTS回続けて発生した場合、再試行を打ち切りAppExceptionを投げる（Issue #106フォローアップ）', async () => {
      const httpServicePatch = vi.fn().mockReturnValue(throwError(() => ({ isAxiosError: true, code: 'ECONNRESET' })));
      const client = await createClient(vi.fn(), vi.fn(), httpServicePatch);
      const sourcePath = join(dir, 'source.zip');
      writeFileSync(sourcePath, Buffer.from('zip-content'));

      try {
        await client.uploadFileFromPath('token-xyz', 'file-1', sourcePath, undefined, 0);
        expect.unreachable('例外が投げられるはず');
      } catch (error) {
        assertIsAppException(error);
        expect(error.getResponse()).toEqual(expect.objectContaining({ errorCode: APP_ERROR_CODE.googleDriveApiError }));
      }
      expect(httpServicePatch).toHaveBeenCalledTimes(UPLOAD_RETRY_MAX_ATTEMPTS);
    });
  });

  describe('refreshToken', () => {
    test('client_id/client_secret/refresh_token/grant_typeをボディに含めてPOSTし、レスポンスのdataを返す', async () => {
      const tokenResponse = { access_token: 'access-token-1', expires_in: 3600 };
      const httpServicePost = vi.fn().mockReturnValue(of({ data: tokenResponse }));
      const client = await createClient(vi.fn(), httpServicePost);

      const result = await client.refreshToken({
        clientId: 'client-id',
        clientSecret: 'client-secret',
        refreshToken: 'refresh-token'
      });

      expect(result).toEqual(tokenResponse);
      expect(httpServicePost).toHaveBeenCalledWith(
        expect.any(String),
        {
          client_id: 'client-id',
          client_secret: 'client-secret',
          refresh_token: 'refresh-token',
          grant_type: 'refresh_token'
        },
        expect.objectContaining({ timeout: expect.any(Number) })
      );
    });

    test('失敗した場合、errorCode: GOOGLE_DRIVE_AUTH_FAILEDのAppExceptionを投げる(401)', async () => {
      const httpServicePost = vi
        .fn()
        .mockReturnValue(throwError(() => ({ isAxiosError: true, response: { status: 401 } })));
      const client = await createClient(vi.fn(), httpServicePost);

      try {
        await client.refreshToken({ clientId: 'a', clientSecret: 'b', refreshToken: 'c' });
        expect.unreachable('例外が投げられるはず');
      } catch (error) {
        assertIsAppException(error);
        expect(error.getResponse()).toEqual(
          expect.objectContaining({ errorCode: APP_ERROR_CODE.googleDriveAuthFailed })
        );
      }
    });
  });

  describe('deleteFile', () => {
    test('アクセストークンをAuthorizationヘッダーに含め、指定したファイルを削除する', async () => {
      const httpServiceDelete = vi.fn().mockReturnValue(of({ data: undefined }));
      const client = await createClient(vi.fn(), vi.fn(), vi.fn(), vi.fn(), httpServiceDelete);

      await client.deleteFile('token-xyz', 'file-1');

      expect(httpServiceDelete).toHaveBeenCalledWith(
        expect.stringContaining('/files/file-1'),
        expect.objectContaining({ headers: { Authorization: 'Bearer token-xyz' } })
      );
    });

    test('失敗した場合、errorCode: GOOGLE_DRIVE_API_ERRORのAppExceptionを投げる', async () => {
      const httpServiceDelete = vi
        .fn()
        .mockReturnValue(throwError(() => ({ isAxiosError: true, response: { status: 500 } })));
      const client = await createClient(vi.fn(), vi.fn(), vi.fn(), vi.fn(), httpServiceDelete);

      try {
        await client.deleteFile('token-xyz', 'file-1');
        expect.unreachable('例外が投げられるはず');
      } catch (error) {
        assertIsAppException(error);
        expect(error.getResponse()).toEqual(expect.objectContaining({ errorCode: APP_ERROR_CODE.googleDriveApiError }));
      }
    });
  });
});
