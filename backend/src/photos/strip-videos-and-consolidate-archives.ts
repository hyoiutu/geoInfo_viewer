import 'dotenv/config';
import { writeSync } from 'node:fs';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import AdmZip from 'adm-zip';
import { DataSource } from 'typeorm';
import { createDataSourceOptions } from '../database/database.config';
import { GoogleDriveApiClient } from '../google-drive/google-drive-api.client';
import { GoogleDriveAuthService } from '../google-drive/google-drive-auth.service';
import { type ArchiveSourceEntry, consolidateArchiveWithoutVideos } from './consolidate-monthly-archive.util';
import { MonthlyPhotoArchiveEntity } from './entities/monthly-photo-archive.entity';
import { PhotoEntity } from './entities/photo.entity';
import { VideoStrippedYearMonthEntity } from './entities/video-stripped-year-month.entity';

// part列が存在しなかった時代の「その年月の全写真を含む唯一のzip」を表す特別な値
// （backfill-photos-from-local.tsのLEGACY_WHOLE_MONTH_PARTと同じ意味）。本スクリプトによる
// 統合後のアーカイブも「1年月=1zip」という同じ状態になるため、同じ値を再利用する（Issue #97）
const LEGACY_WHOLE_MONTH_PART = -1;

// 1年月分の合計サイズがこれを超える場合、メモリ上へ全アーカイブを展開する際の不足クラッシュを避けるため
// 今回はスキップする（写真ローカルバックフィルの実行時に実際に発生した問題と同種、Issue #23）
const MAX_MONTH_SIZE_BYTES_FOR_SAFE_PROCESSING = 2 * 1024 * 1024 * 1024;

// console.logはパイプ経由の出力時にNode.jsによって非同期にバッファリングされ、外部要因でプロセスが
// 停止した場合に未フラッシュの行が失われうるため、fs.writeSyncで同期的にログを出力する
// （backfill-photos-from-local.tsと同じ対策、Issue #23）
const log = (message: string): void => {
  writeSync(1, `${message}\n`);
};

/**
 * 既存の月別アーカイブzip（写真ローカルバックフィルで作成済み）から動画エントリを削除し、
 * サイズ超過により複数partへ分割されていた年月は単一のzipへ統合する（Issue #97）。
 * 動画は写真グリッド表示（静止画プレビューのみ）に使われておらず容量のみを圧迫していたため、
 * 削除してGoogle Drive上の容量・写真表示時のダウンロード時間を削減する。
 * 元のGoogle Photos側のデータには影響しない（このアプリ用にDriveへコピーした分のみが対象）。
 * 年月ごとに処理し、完了した年月は`video_stripped_year_months`テーブルへ記録することで、
 * 中断・再実行時に処理済みの年月を丸ごとスキップする
 */
const stripVideosAndConsolidateArchives = async (): Promise<void> => {
  const dataSource = new DataSource(createDataSourceOptions(process.env));
  await dataSource.initialize();

  const googleDriveApiClient = new GoogleDriveApiClient(new HttpService());
  const googleDriveAuthService = new GoogleDriveAuthService(googleDriveApiClient, new ConfigService());
  const monthlyPhotoArchiveRepository = dataSource.getRepository(MonthlyPhotoArchiveEntity);
  const photoRepository = dataSource.getRepository(PhotoEntity);
  const videoStrippedRepository = dataSource.getRepository(VideoStrippedYearMonthEntity);

  const allArchives = await monthlyPhotoArchiveRepository.find();
  const strippedYearMonths = new Set((await videoStrippedRepository.find()).map((row) => row.yearMonth));
  const yearMonths = [...new Set(allArchives.map((archive) => archive.yearMonth))].sort();
  const remainingYearMonths = yearMonths.filter((yearMonth) => !strippedYearMonths.has(yearMonth));
  log(
    `対象年月${yearMonths.length}件（処理済み: ${yearMonths.length - remainingYearMonths.length}件、未処理: ${remainingYearMonths.length}件）`
  );

  const skippedTooLargeYearMonths: string[] = [];
  let processedYearMonthCount = 0;
  let removedVideoCount = 0;

  for (const yearMonth of yearMonths) {
    if (strippedYearMonths.has(yearMonth)) {
      log(`[${yearMonth}] 前回の実行で処理済みのためスキップします`);
      continue;
    }

    const archivesForMonth = allArchives.filter((archive) => archive.yearMonth === yearMonth);
    const accessToken = await googleDriveAuthService.getAccessToken();

    let totalSizeBytes = 0;
    for (const archive of archivesForMonth) {
      const metadata = await googleDriveApiClient.getFileMetadata(accessToken, archive.driveFileId);
      totalSizeBytes += Number(metadata.size ?? '0');
    }
    if (totalSizeBytes > MAX_MONTH_SIZE_BYTES_FOR_SAFE_PROCESSING) {
      log(
        `[${yearMonth}] 合計サイズが2GiBを超えるため今回はスキップします（約${(totalSizeBytes / (1024 * 1024 * 1024)).toFixed(2)}GiB）`
      );
      skippedTooLargeYearMonths.push(yearMonth);
      continue;
    }

    log(
      `[${yearMonth}] 処理開始（アーカイブ${archivesForMonth.length}個、合計約${(totalSizeBytes / (1024 * 1024)).toFixed(1)}MiB）`
    );

    const sourceEntries: ArchiveSourceEntry[] = [];
    for (const archive of archivesForMonth) {
      const zipBuffer = await googleDriveApiClient.downloadFile(accessToken, archive.driveFileId);
      for (const entry of new AdmZip(zipBuffer).getEntries()) {
        sourceEntries.push({ sourceFileId: archive.driveFileId, archivePath: entry.entryName, data: entry.getData() });
      }
    }

    const { zipBuffer, keptEntries, removedVideoEntries } = consolidateArchiveWithoutVideos(sourceEntries);

    if (removedVideoEntries.length === 0 && archivesForMonth.length === 1) {
      log(`[${yearMonth}] 動画は含まれておらず既に単一のアーカイブのため、変更せず処理済みとして記録します`);
      await videoStrippedRepository.save({ yearMonth });
      processedYearMonthCount += 1;
      continue;
    }

    const newDriveFileId = await googleDriveApiClient.createFileMetadata(accessToken, `${yearMonth}.zip`);
    await googleDriveApiClient.updateFileContent(accessToken, newDriveFileId, zipBuffer);
    log(`[${yearMonth}] 動画を除いた統合zip（${keptEntries.length}件）のアップロードが完了しました`);

    for (const kept of keptEntries) {
      await photoRepository.update(
        { sourceFileId: kept.sourceFileId, archivePath: kept.oldArchivePath },
        { sourceFileId: newDriveFileId, archivePath: kept.newArchivePath }
      );
    }
    for (const removed of removedVideoEntries) {
      await photoRepository.delete({ sourceFileId: removed.sourceFileId, archivePath: removed.archivePath });
    }

    await monthlyPhotoArchiveRepository.delete({ yearMonth });
    await monthlyPhotoArchiveRepository.save({
      yearMonth,
      part: LEGACY_WHOLE_MONTH_PART,
      driveFileId: newDriveFileId
    });
    await videoStrippedRepository.save({ yearMonth });

    // 古いDriveファイルの削除はDB側が既に新しいファイルを正しく参照した後のベストエフォートな
    // 後始末のため、失敗してもこの年月の処理自体は成功として扱う（Driveの容量を無駄にするだけで
    // データの整合性は壊れない。失敗した場合は手動での削除が必要）
    for (const archive of archivesForMonth) {
      try {
        await googleDriveApiClient.deleteFile(accessToken, archive.driveFileId);
      } catch (error) {
        console.error(`[${yearMonth}] 古いアーカイブ（${archive.driveFileId}）の削除に失敗しました:`, error);
      }
    }

    processedYearMonthCount += 1;
    removedVideoCount += removedVideoEntries.length;
    log(`[${yearMonth}] 完了しました（写真${keptEntries.length}件を保持、動画${removedVideoEntries.length}件を削除）`);
  }

  await dataSource.destroy();
  log(
    `完了しました（処理済み年月: ${processedYearMonthCount}件、削除した動画: ${removedVideoCount}件、サイズ超過によりスキップ: ${skippedTooLargeYearMonths.length}件）`
  );
  if (skippedTooLargeYearMonths.length > 0) {
    log('サイズ超過によりスキップした年月（手動対応が必要）:');
    for (const yearMonth of skippedTooLargeYearMonths) {
      log(`  - ${yearMonth}`);
    }
  }
};

stripVideosAndConsolidateArchives().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
