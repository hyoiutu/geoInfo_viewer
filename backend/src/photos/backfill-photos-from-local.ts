import 'dotenv/config';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { createDataSourceOptions } from '../database/database.config';
import { GoogleDriveApiClient } from '../google-drive/google-drive-api.client';
import { GoogleDriveAuthService } from '../google-drive/google-drive-auth.service';
import { MonthlyPhotoArchiveEntity } from './entities/monthly-photo-archive.entity';
import { PhotoEntity } from './entities/photo.entity';
import { groupPhotosByYearMonth, type PhotoWithMetadata } from './group-photos-by-year-month.util';
import { type LocalArchiveEntry, readLocalPhotoData, scanLocalPhotoDirectory } from './local-photo-directory.util';
import { MonthlyPhotoArchiveService } from './monthly-photo-archive.service';
import { toPhotoEntity } from './photo-ingest.service';
import { resolvePhotoMetadata } from './takeout-metadata.util';
import { matchPhotosWithJsonSidecars } from './takeout-photo-matcher.util';

/**
 * ローカルディレクトリに展開済みの写真＋JSONサイドカーを取り込み、撮影年月ごとの月別アーカイブへ
 * 再構成してphotosテーブルへ保存する。Google Takeoutのzip自体（50GB級）をNode.jsのBuffer上限を
 * 超えてそのまま扱うことができないため、ユーザーが事前にzipを展開しローカルの1フラットディレクトリへ
 * 集約したものを入力とする（Issue #23）。
 * メモリ使用量を抑えるため、写真本体の実バイナリは以下の2箇所でのみその場限りで読み込む。
 *   - メタデータ解決時（JSONサイドカーが無い/不正な場合のEXIFフォールバック用）
 *   - 月別アーカイブへの再構成時（1ヶ月分のグループごとに読み込む。全件を同時には保持しない）
 * @param directoryPath 走査対象のローカルディレクトリパス
 */
const backfillPhotosFromLocalDirectory = async (directoryPath: string): Promise<void> => {
  const dataSource = new DataSource(createDataSourceOptions(process.env));
  await dataSource.initialize();

  const googleDriveApiClient = new GoogleDriveApiClient(new HttpService());
  const googleDriveAuthService = new GoogleDriveAuthService(googleDriveApiClient, new ConfigService());
  const monthlyPhotoArchiveService = new MonthlyPhotoArchiveService(
    googleDriveApiClient,
    dataSource.getRepository(MonthlyPhotoArchiveEntity)
  );
  const photoRepository = dataSource.getRepository(PhotoEntity);

  const { photoEntries, jsonEntries } = scanLocalPhotoDirectory(directoryPath);
  const localEntryByPath = new Map<string, LocalArchiveEntry>(photoEntries.map((entry) => [entry.path, entry]));
  const matched = matchPhotosWithJsonSidecars(photoEntries, jsonEntries);
  console.log(`${matched.length}件の写真を検出しました`);

  const photosWithMetadata: PhotoWithMetadata[] = [];
  let skippedCount = 0;
  for (const { photo, json } of matched) {
    const localEntry = localEntryByPath.get(photo.path);
    if (localEntry === undefined) {
      throw new Error(`写真エントリの読み込みに失敗しました: ${photo.path}`);
    }

    const metadata = await resolvePhotoMetadata(readLocalPhotoData(localEntry), json);
    if (metadata === null) {
      skippedCount += 1;
      continue;
    }
    photosWithMetadata.push({ entry: { path: photo.path, data: Buffer.alloc(0) }, metadata });
  }
  console.log(`メタデータを解決しました（保存対象: ${photosWithMetadata.length}件、スキップ: ${skippedCount}件）`);

  const groups = groupPhotosByYearMonth(photosWithMetadata);
  const accessToken = await googleDriveAuthService.getAccessToken();

  let savedCount = 0;
  for (const group of groups) {
    const groupWithData = {
      yearMonth: group.yearMonth,
      photos: group.photos.map((photo) => {
        const localEntry = localEntryByPath.get(photo.entry.path);
        if (localEntry === undefined) {
          throw new Error(`写真エントリの読み込みに失敗しました: ${photo.entry.path}`);
        }
        return { entry: readLocalPhotoData(localEntry), metadata: photo.metadata };
      })
    };

    const reorganized = await monthlyPhotoArchiveService.reorganize(accessToken, [groupWithData]);
    const entities = reorganized.map((photo) => toPhotoEntity(photo));
    if (entities.length > 0) {
      await photoRepository.save(entities);
      savedCount += entities.length;
    }
    console.log(`[${group.yearMonth}] ${entities.length}件を月別アーカイブへ振り分け・保存しました`);
  }

  await dataSource.destroy();
  console.log(`完了しました（保存: ${savedCount}件、スキップ: ${skippedCount}件）`);
};

const directoryPath = process.argv[2];
if (directoryPath === undefined) {
  console.error('使い方: ts-node src/photos/backfill-photos-from-local.ts <ローカルディレクトリパス>');
  process.exitCode = 1;
} else {
  backfillPhotosFromLocalDirectory(directoryPath).catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
