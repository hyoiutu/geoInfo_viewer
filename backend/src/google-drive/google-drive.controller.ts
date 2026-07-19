import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GOOGLE_DRIVE_FILES_ROUTE, GOOGLE_DRIVE_ROUTE } from './google-drive.constants';
import { GoogleDriveFilesService } from './google-drive-files.service';
import type { GoogleDriveFileInfoDto } from './types/google-drive-file-info.dto';

/**
 * GCP設定・Google Drive連携が実際に機能しているかを検証するためのモックコントローラー（Issue #23）。
 * 「アクティビティ日時に基づく写真検索・地図/サイドバー表示」等の本実装は別途行う。
 */
@ApiTags('google-drive')
@Controller(GOOGLE_DRIVE_ROUTE)
export class GoogleDriveController {
  constructor(private readonly googleDriveFilesService: GoogleDriveFilesService) {}

  /** GET /google-drive/files/:fileId: 指定したDriveファイルのメタデータ取得・ダウンロードを行い結果を返す */
  @Get(GOOGLE_DRIVE_FILES_ROUTE)
  getFile(@Param('fileId') fileId: string): Promise<GoogleDriveFileInfoDto> {
    return this.googleDriveFilesService.fetchFileInfo(fileId);
  }
}
