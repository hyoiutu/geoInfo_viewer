import { Test } from '@nestjs/testing';
import { describe, expect, test, vi } from 'vitest';
import { GoogleDriveController } from '../google-drive.controller';
import { GoogleDriveFilesService } from '../google-drive-files.service';
import type { GoogleDriveFileInfoDto } from '../types/google-drive-file-info.dto';

const createFileInfo = (overrides: Partial<GoogleDriveFileInfoDto>): GoogleDriveFileInfoDto => ({
  fileId: 'file-1',
  name: 'takeout.zip',
  mimeType: 'application/zip',
  expectedSizeBytes: '11',
  downloadedBytes: 11,
  sizeMatches: true,
  ...overrides
});

describe('GoogleDriveControllerに関するテスト', () => {
  const createController = async (fetchFileInfo: ReturnType<typeof vi.fn>) => {
    const moduleRef = await Test.createTestingModule({
      controllers: [GoogleDriveController],
      providers: [{ provide: GoogleDriveFilesService, useValue: { fetchFileInfo } }]
    }).compile();

    return moduleRef.get(GoogleDriveController);
  };

  test('GET /google-drive/files/:fileId: 指定したfileIdでサービスを呼び出し、結果をそのまま返す', async () => {
    const fileInfo = createFileInfo({ fileId: 'file-42' });
    const fetchFileInfo = vi.fn().mockResolvedValue(fileInfo);
    const controller = await createController(fetchFileInfo);

    const result = await controller.getFile('file-42');

    expect(result).toEqual(fileInfo);
    expect(fetchFileInfo).toHaveBeenCalledWith('file-42');
  });
});
