import { ApiProperty } from '@nestjs/swagger';

/** GET /google-drive/files/:fileId のレスポンス。GCP設定・Drive連携が機能しているかを検証するためのモックDTO（Issue #23） */
export class GoogleDriveFileInfoDto {
  @ApiProperty({ description: 'DriveファイルID' })
  fileId!: string;

  @ApiProperty({ description: 'ファイル名' })
  name!: string;

  @ApiProperty({ description: 'MIMEタイプ' })
  mimeType!: string;

  @ApiProperty({
    description: 'Driveのメタデータが報告するファイルサイズ（バイト数）。取得できない場合はnull',
    nullable: true
  })
  expectedSizeBytes!: string | null;

  @ApiProperty({ description: '実際にダウンロードできたバイト数' })
  downloadedBytes!: number;

  @ApiProperty({
    description: 'expectedSizeBytesとdownloadedBytesが一致するか。expectedSizeBytesが無い場合はnull',
    nullable: true
  })
  sizeMatches!: boolean | null;
}
