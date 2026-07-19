import { basename } from 'node:path';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { GoogleDriveApiClient } from '../google-drive/google-drive-api.client';
import { GoogleDriveAuthService } from '../google-drive/google-drive-auth.service';
import { PhotoEntity } from './entities/photo.entity';
import { groupPhotosByYearMonth, type PhotoWithMetadata } from './group-photos-by-year-month.util';
import { MonthlyPhotoArchiveService, type ReorganizedPhoto } from './monthly-photo-archive.service';
import { extractTakeoutArchive, type TakeoutArchiveEntry } from './takeout-archive.util';
import { extractMetadataFromExif, extractMetadataFromJson, type PhotoMetadata } from './takeout-metadata.util';
import { matchPhotosWithJsonSidecars } from './takeout-photo-matcher.util';
import type { PhotoIngestResultDto } from './types/photo-ingest-result.dto';

/**
 * 指定した写真エントリのメタデータを、JSONサイドカー優先・EXIF直読みフォールバックの順で解決する
 * @param photo 写真本体のエントリ
 * @param json マッチしたJSONサイドカーのエントリ。見つからない場合はnull
 * @returns 解決できたメタデータ。JSON・EXIFいずれからも取得できない場合はnull
 */
const resolvePhotoMetadata = async (
  photo: TakeoutArchiveEntry,
  json: TakeoutArchiveEntry | null
): Promise<PhotoMetadata | null> => {
  const jsonMetadata = json !== null ? extractMetadataFromJson(json.data) : null;
  return jsonMetadata ?? (await extractMetadataFromExif(photo.data));
};

/**
 * Google Takeoutのzip（fileId指定でGoogle Driveからダウンロード）を取り込み、写真本体とJSON
 * サイドカーを紐付けて撮影日時・位置情報を抽出する。抽出した写真は撮影年月ごとにグループ分けし、
 * 対応する月別アーカイブzipへ再構成した上で、`photos`テーブルへメタデータのみを保存する。
 * 写真の実バイナリ自体はphotosテーブルには保存しない（Issue #23）
 */
@Injectable()
export class PhotoIngestService {
  constructor(
    private readonly googleDriveAuthService: GoogleDriveAuthService,
    private readonly googleDriveApiClient: GoogleDriveApiClient,
    private readonly monthlyPhotoArchiveService: MonthlyPhotoArchiveService,
    @InjectRepository(PhotoEntity)
    private readonly photoRepository: Repository<PhotoEntity>
  ) {}

  /**
   * 指定したGoogle Drive上のTakeout zipを取り込み、撮影年月ごとの月別アーカイブへ再構成する
   * @param fileId 取り込み対象のzipのGoogle DriveファイルID
   * @returns 保存件数・スキップ件数
   */
  async ingest(fileId: string): Promise<PhotoIngestResultDto> {
    const accessToken = await this.googleDriveAuthService.getAccessToken();
    const zipBuffer = await this.googleDriveApiClient.downloadFile(accessToken, fileId);
    const { photoEntries, jsonEntries } = extractTakeoutArchive(zipBuffer);
    const matched = matchPhotosWithJsonSidecars(photoEntries, jsonEntries);

    const photosWithMetadata: PhotoWithMetadata[] = [];
    let skippedCount = 0;
    for (const { photo, json } of matched) {
      const metadata = await resolvePhotoMetadata(photo, json);
      if (metadata === null) {
        skippedCount += 1;
        continue;
      }
      photosWithMetadata.push({ entry: photo, metadata });
    }

    const groups = groupPhotosByYearMonth(photosWithMetadata);
    const reorganized = await this.monthlyPhotoArchiveService.reorganize(accessToken, groups);

    const entities = reorganized.map((photo) => this.toPhotoEntity(photo));
    if (entities.length > 0) {
      await this.photoRepository.save(entities);
    }

    return { savedCount: entities.length, skippedCount };
  }

  /**
   * 月別アーカイブへの振り分け結果から、保存用のPhotoEntityを組み立てる
   * @param reorganized 振り分け後の写真と保存先アーカイブ情報
   * @returns 保存用のPhotoEntity
   */
  private toPhotoEntity(reorganized: ReorganizedPhoto): PhotoEntity {
    const entity = new PhotoEntity();
    entity.fileName = basename(reorganized.photo.entry.path);
    entity.takenAt = reorganized.photo.metadata.takenAt;
    entity.location = reorganized.photo.metadata.location;
    entity.sourceFileId = reorganized.sourceFileId;
    entity.archivePath = reorganized.archivePath;
    return entity;
  }
}
