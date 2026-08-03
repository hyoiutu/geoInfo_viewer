import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { GoogleDriveApiClient } from '../google-drive/google-drive-api.client';
import { MonthlyPhotoThumbnailArchiveEntity } from './entities/monthly-photo-thumbnail-archive.entity';
import { mergeMonthlyThumbnailArchive, type ThumbnailToMerge } from './monthly-archive.util';

const THUMBNAIL_ARCHIVE_FILE_SUFFIX = '-thumbnails.zip';

/**
 * 撮影年月ごとのサムネイル一覧を、Google Drive上のサムネイル専用月別アーカイブzip
 * （`<年月>-thumbnails.zip`）へ追記して保存する。フルサイズ写真用の`MonthlyPhotoArchiveService`と異なり、
 * サムネイルzipは常にpart列を持たず1年月=1zipのため（`MonthlyPhotoThumbnailArchiveEntity`参照）、
 * `backfill-photos-from-local.ts`が日付ベースの複数part（Issue #91）を1つずつ処理する中でも、
 * 同じ1つのzipへ追記を繰り返す（Issue #104。写真ローカル前処理段階での動画除外・サムネイル生成の前倒し）
 */
@Injectable()
export class MonthlyPhotoThumbnailArchiveService {
  constructor(
    private readonly googleDriveApiClient: GoogleDriveApiClient,
    @InjectRepository(MonthlyPhotoThumbnailArchiveEntity)
    private readonly thumbnailArchiveRepository: Repository<MonthlyPhotoThumbnailArchiveEntity>
  ) {}

  /**
   * 指定した年月のサムネイル一覧を、既存のサムネイルzip（無ければ新規作成）へ追記して保存する
   * @param accessToken Google Driveのアクセストークン
   * @param yearMonth 撮影年月（'YYYY-MM'形式）
   * @param thumbnails 追記するサムネイル一覧。archivePathは対応するフルサイズ写真の
   * `mergeMonthlyArchive`（`MonthlyPhotoArchiveService.reorganize`）結果と一致させる必要がある
   */
  async appendThumbnails(accessToken: string, yearMonth: string, thumbnails: ThumbnailToMerge[]): Promise<void> {
    if (thumbnails.length === 0) {
      return;
    }

    const archive = await this.thumbnailArchiveRepository.findOneBy({ yearMonth });
    const existingZipBuffer =
      archive !== null ? await this.googleDriveApiClient.downloadFile(accessToken, archive.driveFileId) : null;

    const zipBuffer = mergeMonthlyThumbnailArchive(existingZipBuffer ?? null, thumbnails);

    if (archive !== null) {
      await this.googleDriveApiClient.updateFileContent(accessToken, archive.driveFileId, zipBuffer);
      return;
    }

    const driveFileId = await this.googleDriveApiClient.createFileMetadata(
      accessToken,
      `${yearMonth}${THUMBNAIL_ARCHIVE_FILE_SUFFIX}`
    );
    await this.googleDriveApiClient.updateFileContent(accessToken, driveFileId, zipBuffer);
    await this.thumbnailArchiveRepository.save({ yearMonth, driveFileId });
  }
}
