import 'dotenv/config';
import { mkdtempSync, rmSync, writeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { createDataSourceOptions } from '../database/database.config';
import { GoogleDriveApiClient } from '../google-drive/google-drive-api.client';
import { GoogleDriveAuthService } from '../google-drive/google-drive-auth.service';
import { MonthlyPhotoArchiveEntity } from './entities/monthly-photo-archive.entity';
import { MonthlyPhotoThumbnailArchiveEntity } from './entities/monthly-photo-thumbnail-archive.entity';
import { VideoStrippedYearMonthEntity } from './entities/video-stripped-year-month.entity';
import { generateThumbnailArchiveStreaming } from './generate-thumbnail-archive-streaming.util';

// console.logはパイプ経由の出力時にNode.jsによって非同期にバッファリングされ、外部要因でプロセスが
// 停止した場合に未フラッシュの行が失われうるため、fs.writeSyncで同期的にログを出力する
// （strip-videos-and-consolidate-archives.tsと同じ対策、Issue #23）
const log = (message: string): void => {
  writeSync(1, `${message}\n`);
};

/**
 * グリッド・吹き出し表示を高速化するため、月別アーカイブzipから横300px（縦横比維持）の
 * サムネイル画像のみを集めた専用zip（`<年月>-thumbnails.zip`）をGoogle Drive上に生成する
 * （Issue #100）。既存のフルサイズzip（`monthly_photo_archives`）はそのまま残し、別ファイルとして扱う。
 * 生成対象は動画削除・part統合済み（`video_stripped_year_months`に記録済み）の年月のみに限定する。
 * 未処理・失敗（レガシーアーカイブ破損等、Issue #99参照）の年月は、常に1年月=1zip・動画なしという
 * 前提を満たさないため対象外とする。年月ごとに処理し、完了した年月は`monthly_photo_thumbnail_archives`
 * テーブルへ記録することで、中断・再実行時に処理済みの年月を丸ごとスキップする。
 * 1つの年月の処理に失敗しても、他の年月の処理を止めずに次へ進む
 */
const generateThumbnailArchives = async (): Promise<void> => {
  const dataSource = new DataSource(createDataSourceOptions(process.env));
  await dataSource.initialize();

  const googleDriveApiClient = new GoogleDriveApiClient(new HttpService());
  const googleDriveAuthService = new GoogleDriveAuthService(googleDriveApiClient, new ConfigService());
  const monthlyPhotoArchiveRepository = dataSource.getRepository(MonthlyPhotoArchiveEntity);
  const videoStrippedRepository = dataSource.getRepository(VideoStrippedYearMonthEntity);
  const thumbnailArchiveRepository = dataSource.getRepository(MonthlyPhotoThumbnailArchiveEntity);

  const targetYearMonths = (await videoStrippedRepository.find()).map((row) => row.yearMonth).sort();
  const doneYearMonths = new Set((await thumbnailArchiveRepository.find()).map((row) => row.yearMonth));
  const remainingCount = targetYearMonths.filter((yearMonth) => !doneYearMonths.has(yearMonth)).length;
  log(
    `対象年月${targetYearMonths.length}件（処理済み: ${targetYearMonths.length - remainingCount}件、未処理: ${remainingCount}件）`
  );

  let processedCount = 0;
  const failedYearMonths: string[] = [];

  for (const yearMonth of targetYearMonths) {
    if (doneYearMonths.has(yearMonth)) {
      log(`[${yearMonth}] 前回の実行で処理済みのためスキップします`);
      continue;
    }

    try {
      const archive = await monthlyPhotoArchiveRepository.findOneBy({ yearMonth });
      if (archive === null) {
        log(`[${yearMonth}] monthly_photo_archivesにレコードが見つからないためスキップします`);
        continue;
      }

      const accessToken = await googleDriveAuthService.getAccessToken();
      log(`[${yearMonth}] 処理開始`);

      // ダウンロード・生成後のサムネイルzipは、この年月の処理が終わるまでの作業ディレクトリへ
      // 一時的に保存する。処理の成否に関わらず、次の年月へ進む前に必ず削除する
      const workDir = mkdtempSync(join(tmpdir(), `thumbnail-${yearMonth}-`));
      try {
        const sourcePath = join(workDir, 'source.zip');
        await googleDriveApiClient.downloadFileToPath(accessToken, archive.driveFileId, sourcePath);

        const destPath = join(workDir, 'thumbnails.zip');
        const { entries } = await generateThumbnailArchiveStreaming(sourcePath, destPath);

        const newDriveFileId = await googleDriveApiClient.createFileMetadata(
          accessToken,
          `${yearMonth}-thumbnails.zip`
        );
        await googleDriveApiClient.uploadFileFromPath(accessToken, newDriveFileId, destPath);

        await thumbnailArchiveRepository.save({ yearMonth, driveFileId: newDriveFileId });
        processedCount += 1;
        log(`[${yearMonth}] 完了しました（サムネイル${entries.length}件を生成）`);
      } finally {
        rmSync(workDir, { recursive: true, force: true });
      }
    } catch (error) {
      // 1つの年月の処理に失敗しても、他の年月の処理を巻き添えで止めない
      // （strip-videos-and-consolidate-archives.tsと同じ設計、Issue #99）
      console.error(`[${yearMonth}] 処理に失敗したため、この年月をスキップして次へ進みます:`, error);
      failedYearMonths.push(yearMonth);
    }
  }

  await dataSource.destroy();
  log(`完了しました（処理済み年月: ${processedCount}件、失敗した年月: ${failedYearMonths.length}件）`);
  if (failedYearMonths.length > 0) {
    log('処理に失敗した年月（手動確認が必要）:');
    for (const yearMonth of failedYearMonths) {
      log(`  - ${yearMonth}`);
    }
  }
};

generateThumbnailArchives().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
