import { basename } from 'node:path';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { GoogleDriveApiClient } from '../google-drive/google-drive-api.client';
import { GoogleDriveAuthService } from '../google-drive/google-drive-auth.service';
import { PhotoEntity } from './entities/photo.entity';
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
 * サイドカーを紐付けて撮影日時・位置情報を抽出し、`photos`テーブルへメタデータのみを保存する。
 * 写真の実バイナリ自体は保存しない（Issue #23）
 */
@Injectable()
export class PhotoIngestService {
  constructor(
    private readonly googleDriveAuthService: GoogleDriveAuthService,
    private readonly googleDriveApiClient: GoogleDriveApiClient,
    @InjectRepository(PhotoEntity)
    private readonly photoRepository: Repository<PhotoEntity>
  ) {}

  /**
   * 指定したGoogle Drive上のTakeout zipを取り込む
   * @param fileId 取り込み対象のzipのGoogle DriveファイルID
   * @returns 保存件数・スキップ件数
   */
  async ingest(fileId: string): Promise<PhotoIngestResultDto> {
    const accessToken = await this.googleDriveAuthService.getAccessToken();
    const zipBuffer = await this.googleDriveApiClient.downloadFile(accessToken, fileId);
    const { photoEntries, jsonEntries } = extractTakeoutArchive(zipBuffer);
    const matched = matchPhotosWithJsonSidecars(photoEntries, jsonEntries);

    const entities: PhotoEntity[] = [];
    let skippedCount = 0;
    for (const { photo, json } of matched) {
      const metadata = await resolvePhotoMetadata(photo, json);
      if (metadata === null) {
        skippedCount += 1;
        continue;
      }
      entities.push(this.toPhotoEntity(photo, fileId, metadata));
    }

    if (entities.length > 0) {
      await this.photoRepository.save(entities);
    }

    return { savedCount: entities.length, skippedCount };
  }

  /**
   * 写真エントリと抽出済みメタデータから、保存用のPhotoEntityを組み立てる
   * @param photo 写真本体のエントリ
   * @param sourceFileId 取り込み元のzipのGoogle DriveファイルID
   * @param metadata 抽出済みのメタデータ
   * @returns 保存用のPhotoEntity
   */
  private toPhotoEntity(photo: TakeoutArchiveEntry, sourceFileId: string, metadata: PhotoMetadata): PhotoEntity {
    const entity = new PhotoEntity();
    entity.fileName = basename(photo.path);
    entity.takenAt = metadata.takenAt;
    entity.location = metadata.location;
    entity.sourceFileId = sourceFileId;
    entity.archivePath = photo.path;
    return entity;
  }
}
