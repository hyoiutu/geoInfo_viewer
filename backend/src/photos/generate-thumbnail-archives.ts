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
import { assertHeifConvertAvailable } from './heic-conversion.util';

// console.logはパイプ経由の出力時にNode.jsによって非同期にバッファリングされ、外部要因でプロセスが
// 停止した場合に未フラッシュの行が失われうるため、fs.writeSyncで同期的にログを出力する
// （strip-videos-and-consolidate-archives.tsと同じ対策、Issue #23）
const log = (message: string): void => {
  writeSync(1, `${message}\n`);
};

// 個々の写真のサムネイル生成失敗(failedEntries)は年月単位の完了記録(monthly_photo_thumbnail_archives)には
// 現れないため、HEIC/Motion Photo対応（Issue #100フォローアップ）等でサムネイル生成方式を改善した後、
// 失敗を含んでいた年月だけを選んで再生成したい場合に、この環境変数でカンマ区切りの年月(YYYY-MM)を指定する。
// 指定された年月は、既に処理済み(doneYearMonthToDriveFileId)であっても再処理の対象として扱う
const FORCE_REPROCESS_YEAR_MONTHS_ENV_VAR = 'FORCE_REPROCESS_YEAR_MONTHS';

/**
 * グリッド・吹き出し表示を高速化するため、月別アーカイブzipから横300px（縦横比維持）の
 * サムネイル画像のみを集めた専用zip（`<年月>-thumbnails.zip`）をGoogle Drive上に生成する
 * （Issue #100）。既存のフルサイズzip（`monthly_photo_archives`）はそのまま残し、別ファイルとして扱う。
 * 生成対象は動画削除・part統合済み（`video_stripped_year_months`に記録済み）の年月のみに限定する。
 * 未処理・失敗（レガシーアーカイブ破損等、Issue #99参照）の年月は、常に1年月=1zip・動画なしという
 * 前提を満たさないため対象外とする。年月ごとに処理し、完了した年月は`monthly_photo_thumbnail_archives`
 * テーブルへ記録することで、中断・再実行時に処理済みの年月を丸ごとスキップする。
 * `FORCE_REPROCESS_YEAR_MONTHS`環境変数で指定された年月は、処理済みでも再処理する（用途は上記定数の
 * コメント参照）。再処理により新しいサムネイルzipへ差し替わった場合、古いDriveファイルの削除は
 * DB側が新しいファイルを正しく参照した後のベストエフォートな後始末とする
 * （`strip-videos-and-consolidate-archives.ts`と同じパターン。失敗してもDriveの容量を無駄にするだけで
 * データの整合性は壊れないため、この年月の処理自体は成功として扱う）。
 * 1つの年月の処理に失敗しても、他の年月の処理を止めずに次へ進む。
 *
 * 実行前に必ず`assertHeifConvertAvailable`でheif-convertの可用性を確認し、使えない場合は
 * 何も処理せずエラーで終了する。heif-convertが使えない環境で処理を進めてしまうと、本来sharp単体で
 * 成功していたはずのHEIC写真まで含めて全滅し、既存の（より良い）結果を静かに劣化させて上書きして
 * しまう恐れがあるため（実際に発生した事故の再発防止。詳細は`heic-conversion.util.ts`のTSDoc参照）
 */
const generateThumbnailArchives = async (): Promise<void> => {
  assertHeifConvertAvailable();

  const dataSource = new DataSource(createDataSourceOptions(process.env));
  await dataSource.initialize();

  const googleDriveApiClient = new GoogleDriveApiClient(new HttpService());
  const googleDriveAuthService = new GoogleDriveAuthService(googleDriveApiClient, new ConfigService());
  const monthlyPhotoArchiveRepository = dataSource.getRepository(MonthlyPhotoArchiveEntity);
  const videoStrippedRepository = dataSource.getRepository(VideoStrippedYearMonthEntity);
  const thumbnailArchiveRepository = dataSource.getRepository(MonthlyPhotoThumbnailArchiveEntity);

  const forceReprocessYearMonths = new Set(
    (process.env[FORCE_REPROCESS_YEAR_MONTHS_ENV_VAR] ?? '')
      .split(',')
      .map((yearMonth) => yearMonth.trim())
      .filter((yearMonth) => yearMonth.length > 0)
  );

  const targetYearMonths = (await videoStrippedRepository.find()).map((row) => row.yearMonth).sort();
  const doneYearMonthToDriveFileId = new Map(
    (await thumbnailArchiveRepository.find()).map((row) => [row.yearMonth, row.driveFileId])
  );
  const remainingCount = targetYearMonths.filter(
    (yearMonth) => !doneYearMonthToDriveFileId.has(yearMonth) || forceReprocessYearMonths.has(yearMonth)
  ).length;
  log(
    `対象年月${targetYearMonths.length}件（処理済み: ${targetYearMonths.length - remainingCount}件、未処理: ${remainingCount}件、うち再処理指定: ${forceReprocessYearMonths.size}件）`
  );

  let processedCount = 0;
  let totalFailedEntryCount = 0;
  const failedYearMonths: string[] = [];

  for (const yearMonth of targetYearMonths) {
    if (doneYearMonthToDriveFileId.has(yearMonth) && !forceReprocessYearMonths.has(yearMonth)) {
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
        const { entries, failedEntries } = await generateThumbnailArchiveStreaming(sourcePath, destPath);

        const newDriveFileId = await googleDriveApiClient.createFileMetadata(
          accessToken,
          `${yearMonth}-thumbnails.zip`
        );
        await googleDriveApiClient.uploadFileFromPath(accessToken, newDriveFileId, destPath);

        const oldDriveFileId = doneYearMonthToDriveFileId.get(yearMonth);
        await thumbnailArchiveRepository.save({ yearMonth, driveFileId: newDriveFileId });

        // 再処理により古いサムネイルzipが不要になった場合のベストエフォートな後始末（詳細は関数のTSDoc参照）
        if (oldDriveFileId !== undefined) {
          try {
            await googleDriveApiClient.deleteFile(accessToken, oldDriveFileId);
          } catch (error) {
            console.error(`[${yearMonth}] 古いサムネイルzip（${oldDriveFileId}）の削除に失敗しました:`, error);
          }
        }

        processedCount += 1;
        totalFailedEntryCount += failedEntries.length;
        // 個々の写真のサムネイル生成に失敗しても（一部のHEIC写真でlibheifのセキュリティ上限に
        // 抵触する等）、それ以外の写真のサムネイルは正常に含んだzipとして年月単位では成功扱いとする
        // （generate-thumbnail-archive-streaming.util.ts参照）。失敗した写真があった場合のみログに残す
        if (failedEntries.length > 0) {
          log(
            `[${yearMonth}] サムネイル生成に失敗した写真が${failedEntries.length}件ありました: ${failedEntries.map((entry) => entry.archivePath).join(', ')}`
          );
        }
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
  log(
    `完了しました（処理済み年月: ${processedCount}件、失敗した年月: ${failedYearMonths.length}件、サムネイル生成に失敗した写真: ${totalFailedEntryCount}件）`
  );
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
