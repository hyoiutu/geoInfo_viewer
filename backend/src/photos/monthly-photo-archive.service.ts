import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { GoogleDriveApiClient } from '../google-drive/google-drive-api.client';
import { MonthlyPhotoArchiveEntity } from './entities/monthly-photo-archive.entity';
import type { PhotoWithMetadata, YearMonthGroup } from './group-photos-by-year-month.util';
import { mergeMonthlyArchive } from './monthly-archive.util';

const MONTHLY_ARCHIVE_FILE_EXTENSION = '.zip';

/** reorganizeの戻り値1件分（振り分け後の写真と、その保存先アーカイブ情報） */
export type ReorganizedPhoto = {
  /** 対象の写真 */
  photo: PhotoWithMetadata;
  /** 保存先の月別アーカイブzipのGoogle DriveファイルID */
  sourceFileId: string;
  /** 保存先アーカイブ内でのエントリパス */
  archivePath: string;
};

/**
 * 撮影年月ごとの写真グループを、Google Drive上の月別アーカイブzipへ振り分けて保存する。
 * 対象年月のアーカイブが既存であればダウンロードしてマージ、無ければ新規作成する（Issue #23）
 */
@Injectable()
export class MonthlyPhotoArchiveService {
  constructor(
    private readonly googleDriveApiClient: GoogleDriveApiClient,
    @InjectRepository(MonthlyPhotoArchiveEntity)
    private readonly monthlyPhotoArchiveRepository: Repository<MonthlyPhotoArchiveEntity>
  ) {}

  /**
   * 年月ごとの写真グループをそれぞれ対応する月別アーカイブzipへ振り分けて保存する
   * @param accessToken Google Driveのアクセストークン
   * @param groups 撮影年月（・任意でpart）ごとの写真グループ一覧。partを省略した場合は0として扱う
   * @returns 振り分け後の写真ごとの保存先情報一覧
   */
  async reorganize(accessToken: string, groups: YearMonthGroup[]): Promise<ReorganizedPhoto[]> {
    const reorganized: ReorganizedPhoto[] = [];

    for (const group of groups) {
      const part = group.part ?? 0;
      const archive = await this.monthlyPhotoArchiveRepository.findOneBy({ yearMonth: group.yearMonth, part });
      const existingZipBuffer =
        archive !== null ? await this.googleDriveApiClient.downloadFile(accessToken, archive.driveFileId) : null;

      const { zipBuffer, entries } = mergeMonthlyArchive(existingZipBuffer, group.photos);

      const fileName =
        part > 0
          ? `${group.yearMonth}-part${part + 1}${MONTHLY_ARCHIVE_FILE_EXTENSION}`
          : `${group.yearMonth}${MONTHLY_ARCHIVE_FILE_EXTENSION}`;
      const driveFileId =
        archive?.driveFileId ?? (await this.googleDriveApiClient.createFileMetadata(accessToken, fileName));
      await this.googleDriveApiClient.updateFileContent(accessToken, driveFileId, zipBuffer);

      if (archive === null) {
        const newArchive = new MonthlyPhotoArchiveEntity();
        newArchive.yearMonth = group.yearMonth;
        newArchive.part = part;
        newArchive.driveFileId = driveFileId;
        await this.monthlyPhotoArchiveRepository.save(newArchive);
      }

      for (const entry of entries) {
        reorganized.push({ photo: entry.photo, sourceFileId: driveFileId, archivePath: entry.archivePath });
      }
    }

    return reorganized;
  }
}
