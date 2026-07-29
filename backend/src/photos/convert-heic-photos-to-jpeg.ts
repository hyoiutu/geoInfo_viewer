import 'dotenv/config';
import { writeSync } from 'node:fs';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { DataSource, ILike } from 'typeorm';
import { createDataSourceOptions } from '../database/database.config';
import { GoogleDriveApiClient } from '../google-drive/google-drive-api.client';
import { GoogleDriveAuthService } from '../google-drive/google-drive-auth.service';
import { convertHeicArchiveEntries } from './convert-heic-archive-entries.util';
import { PhotoEntity } from './entities/photo.entity';
import { assertHeifConvertAvailable } from './heic-conversion.util';

// console.logはパイプ経由の出力時にNode.jsによって非同期にバッファリングされ、外部要因でプロセスが
// 停止した場合に未フラッシュの行が失われうるため、fs.writeSyncで同期的にログを出力する
// （backfill-photos-from-local.tsと同じ対策、Issue #23）
const log = (message: string): void => {
  writeSync(1, `${message}\n`);
};

/**
 * `photos`テーブル上でファイル名が`.heic`/`.heif`拡張子の写真を月別アーカイブzip（フルサイズ）から
 * 検出し、JPEGへ変換して同じzip内の`.jpg`エントリへ置き換える（検討事項の回答(a)、元のHEICバイト列は
 * 保持しない。Issue #106）。多くのブラウザ（Safari以外）はHEICをネイティブにデコードできず、
 * `GET /photos/:id/image`がフルサイズHEIC写真をそのまま返すと表示に失敗するため。
 * `generate-thumbnail-archives.ts`（Issue #100）と同じ「未処理分を検出して処理する恒久パイプライン」の
 * パターンを採用しており、専用のone-offスクリプトは用意しない。`photos.file_name`がHEIC拡張子である
 * ことそのものを未処理の判定基準にしているため、変換が完了した写真は次回実行時のクエリに
 * 現れなくなり、追加の進捗管理テーブルなしに冪等性を保てる（初回実行で新規取り込み分・既存アップロード
 * 済みのバックログの両方を自動的にカバーする）。
 * `photos.source_file_id`（月別アーカイブzip）単位でグループ化し、1つのzipにつき1回のダウンロード・
 * アップロードで対象写真をまとめて変換する。1つのzipの処理に失敗しても、他のzipの処理は継続する
 * （`strip-videos-and-consolidate-archives.ts`と同じ設計）。
 * 実行前に必ず`assertHeifConvertAvailable`でheif-convertの可用性を確認する
 * （確認に失敗した場合の事故防止の理由は`heic-conversion.util.ts`のTSDoc参照）
 */
const convertHeicPhotosToJpeg = async (): Promise<void> => {
  assertHeifConvertAvailable();

  const dataSource = new DataSource(createDataSourceOptions(process.env));
  await dataSource.initialize();

  const googleDriveApiClient = new GoogleDriveApiClient(new HttpService());
  const googleDriveAuthService = new GoogleDriveAuthService(googleDriveApiClient, new ConfigService());
  const photoRepository = dataSource.getRepository(PhotoEntity);

  const heicPhotos = await photoRepository.find({
    where: [{ fileName: ILike('%.heic') }, { fileName: ILike('%.heif') }]
  });
  log(`変換対象のHEIC/HEIF写真を${heicPhotos.length}件検出しました`);

  const photosBySourceFileId = new Map<string, PhotoEntity[]>();
  for (const photo of heicPhotos) {
    const group = photosBySourceFileId.get(photo.sourceFileId) ?? [];
    group.push(photo);
    photosBySourceFileId.set(photo.sourceFileId, group);
  }
  log(`対象アーカイブ数: ${photosBySourceFileId.size}件`);

  let convertedCount = 0;
  let failedEntryCount = 0;
  const failedArchiveIds: string[] = [];

  for (const [sourceFileId, photos] of photosBySourceFileId) {
    try {
      const accessToken = await googleDriveAuthService.getAccessToken();
      const zipBuffer = await googleDriveApiClient.downloadFile(accessToken, sourceFileId);

      const targetArchivePaths = photos.map((photo) => photo.archivePath);
      const {
        zipBuffer: convertedZipBuffer,
        converted,
        failed
      } = convertHeicArchiveEntries(zipBuffer, targetArchivePaths);

      if (converted.length > 0) {
        await googleDriveApiClient.updateFileContent(accessToken, sourceFileId, convertedZipBuffer);

        const photoByArchivePath = new Map(photos.map((photo) => [photo.archivePath, photo]));
        const updatedPhotos = converted.map((entry) => {
          const photo = photoByArchivePath.get(entry.originalArchivePath);
          if (photo === undefined) {
            throw new Error(`変換結果に対応する写真が見つかりません: ${entry.originalArchivePath}`);
          }
          photo.fileName = entry.archivePath;
          photo.archivePath = entry.archivePath;
          return photo;
        });
        await photoRepository.save(updatedPhotos);
      }

      convertedCount += converted.length;
      failedEntryCount += failed.length;
      if (failed.length > 0) {
        log(
          `[${sourceFileId}] 変換に失敗した写真が${failed.length}件ありました: ${failed.map((entry) => entry.archivePath).join(', ')}`
        );
      }
      log(`[${sourceFileId}] 完了しました（変換: ${converted.length}件、対象: ${photos.length}件）`);
    } catch (error) {
      // 1つのアーカイブの処理に失敗しても、他のアーカイブの処理を巻き添えで止めない
      // （strip-videos-and-consolidate-archives.tsと同じ設計、Issue #99）
      console.error(`[${sourceFileId}] 処理に失敗したため、このアーカイブをスキップして次へ進みます:`, error);
      failedArchiveIds.push(sourceFileId);
    }
  }

  await dataSource.destroy();
  log(
    `完了しました（変換済み写真: ${convertedCount}件、変換に失敗した写真: ${failedEntryCount}件、失敗したアーカイブ: ${failedArchiveIds.length}件）`
  );
  if (failedArchiveIds.length > 0) {
    log('処理に失敗したアーカイブ（手動確認が必要）:');
    for (const sourceFileId of failedArchiveIds) {
      log(`  - ${sourceFileId}`);
    }
  }
};

convertHeicPhotosToJpeg().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
