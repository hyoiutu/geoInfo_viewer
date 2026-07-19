import { Test } from '@nestjs/testing';
import { describe, expect, test, vi } from 'vitest';
import { GoogleDriveApiClient } from '../google-drive-api.client';
import { GoogleDriveAuthService } from '../google-drive-auth.service';
import { GoogleDriveFilesService } from '../google-drive-files.service';

const createService = async (getFileMetadata: ReturnType<typeof vi.fn>, downloadFile: ReturnType<typeof vi.fn>) => {
  const moduleRef = await Test.createTestingModule({
    providers: [
      GoogleDriveFilesService,
      { provide: GoogleDriveAuthService, useValue: { getAccessToken: vi.fn().mockResolvedValue('access-token-1') } },
      { provide: GoogleDriveApiClient, useValue: { getFileMetadata, downloadFile } }
    ]
  }).compile();

  return moduleRef.get(GoogleDriveFilesService);
};

describe('GoogleDriveFilesServiceに関するテスト', () => {
  test('メタデータのsizeとダウンロード結果のバイト数が一致する場合、sizeMatches: trueを返す', async () => {
    const getFileMetadata = vi
      .fn()
      .mockResolvedValue({ id: 'file-1', name: 'takeout.zip', mimeType: 'application/zip', size: '11' });
    const downloadFile = vi.fn().mockResolvedValue(Buffer.from('hello world'));
    const service = await createService(getFileMetadata, downloadFile);

    const result = await service.fetchFileInfo('file-1');

    expect(result).toEqual({
      fileId: 'file-1',
      name: 'takeout.zip',
      mimeType: 'application/zip',
      expectedSizeBytes: '11',
      downloadedBytes: 11,
      sizeMatches: true
    });
    expect(getFileMetadata).toHaveBeenCalledWith('access-token-1', 'file-1');
    expect(downloadFile).toHaveBeenCalledWith('access-token-1', 'file-1');
  });

  test('メタデータのsizeとダウンロード結果のバイト数が一致しない場合、sizeMatches: falseを返す', async () => {
    const getFileMetadata = vi
      .fn()
      .mockResolvedValue({ id: 'file-1', name: 'takeout.zip', mimeType: 'application/zip', size: '999' });
    const downloadFile = vi.fn().mockResolvedValue(Buffer.from('hello world'));
    const service = await createService(getFileMetadata, downloadFile);

    const result = await service.fetchFileInfo('file-1');

    expect(result.sizeMatches).toBe(false);
  });

  test('メタデータにsizeが含まれない場合、sizeMatches: nullを返す', async () => {
    const getFileMetadata = vi
      .fn()
      .mockResolvedValue({ id: 'file-1', name: 'folder', mimeType: 'application/vnd.google-apps.folder' });
    const downloadFile = vi.fn().mockResolvedValue(Buffer.from(''));
    const service = await createService(getFileMetadata, downloadFile);

    const result = await service.fetchFileInfo('file-1');

    expect(result.expectedSizeBytes).toBeNull();
    expect(result.sizeMatches).toBeNull();
  });
});
