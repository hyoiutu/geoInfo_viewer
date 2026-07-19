import { Injectable } from '@nestjs/common';
import { GoogleDriveApiClient } from './google-drive-api.client';
import { GoogleDriveAuthService } from './google-drive-auth.service';
import type { GoogleDriveFileInfoDto } from './types/google-drive-file-info.dto';

/**
 * 指定したDriveファイルのメタデータ取得・ダウンロードを行い、GCP設定・Drive連携が実際に機能しているかを
 * 検証するためのモックサービス（Issue #23）。「アクティビティ日時に基づく写真検索」等の本実装は別途行う。
 */
@Injectable()
export class GoogleDriveFilesService {
  constructor(
    private readonly googleDriveAuthService: GoogleDriveAuthService,
    private readonly googleDriveApiClient: GoogleDriveApiClient
  ) {}

  /**
   * 指定したファイルのメタデータ取得とダウンロードを行い、両者が整合しているかを含めた結果を返す
   * @param fileId 対象のDriveファイルID
   * @returns ファイル情報（メタデータ・実ダウンロードバイト数・両者の一致結果）
   */
  async fetchFileInfo(fileId: string): Promise<GoogleDriveFileInfoDto> {
    const accessToken = await this.googleDriveAuthService.getAccessToken();
    const metadata = await this.googleDriveApiClient.getFileMetadata(accessToken, fileId);
    const binary = await this.googleDriveApiClient.downloadFile(accessToken, fileId);

    const expectedSizeBytes = metadata.size ?? null;
    return {
      fileId: metadata.id,
      name: metadata.name,
      mimeType: metadata.mimeType,
      expectedSizeBytes,
      downloadedBytes: binary.byteLength,
      sizeMatches: expectedSizeBytes === null ? null : Number(expectedSizeBytes) === binary.byteLength
    };
  }
}
