// biome-ignore-all lint/style/useNamingConvention: Google APIレスポンス形式(snake_case)に合わせたテストダブル
import { HttpService } from '@nestjs/axios';
import { Test } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import { describe, expect, test, vi } from 'vitest';
import { APP_ERROR_CODE } from '../../common/errors/app-error-code.constants';
import { assertIsAppException } from '../../test-utils/assert-is-app-exception';
import { GoogleDriveApiClient } from '../google-drive-api.client';
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
    httpServicePut: ReturnType<typeof vi.fn> = vi.fn()
  ) => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        GoogleDriveApiClient,
        {
          provide: HttpService,
          useValue: { get: httpServiceGet, post: httpServicePost, patch: httpServicePatch, put: httpServicePut }
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
        expect.objectContaining({ headers: { Authorization: 'Bearer token-xyz' } })
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
          responseType: 'arraybuffer'
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
        expect.objectContaining({ headers: { Authorization: 'Bearer token-xyz' } })
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
    test('レジューマブルアップロードのセッションを開始し、取得したURLへコンテンツをPUTする', async () => {
      const httpServicePatch = vi
        .fn()
        .mockReturnValue(of({ headers: { location: 'https://upload.example/session-1' } }));
      const httpServicePut = vi.fn().mockReturnValue(of({ data: createFileMetadata({ id: 'file-1' }) }));
      const client = await createClient(vi.fn(), vi.fn(), httpServicePatch, httpServicePut);
      const content = Buffer.from('zip-content');

      await client.updateFileContent('token-xyz', 'file-1', content);

      expect(httpServicePatch).toHaveBeenCalledWith(expect.stringContaining('/files/file-1'), undefined, {
        headers: { Authorization: 'Bearer token-xyz' },
        params: { uploadType: 'resumable' }
      });
      expect(httpServicePut).toHaveBeenCalledWith('https://upload.example/session-1', content, {
        headers: { 'Content-Type': 'application/zip' }
      });
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
      expect(httpServicePost).toHaveBeenCalledWith(expect.any(String), {
        client_id: 'client-id',
        client_secret: 'client-secret',
        refresh_token: 'refresh-token',
        grant_type: 'refresh_token'
      });
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
});
