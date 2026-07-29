import 'dotenv/config';
import { existsSync, readFileSync, statSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { createDataSourceOptions } from '../database/database.config';
import { GoogleDriveApiClient } from '../google-drive/google-drive-api.client';
import { GoogleDriveAuthService } from '../google-drive/google-drive-auth.service';
import { MonthlyPhotoArchiveEntity } from './entities/monthly-photo-archive.entity';
import { MonthlyPhotoThumbnailArchiveEntity } from './entities/monthly-photo-thumbnail-archive.entity';
import { PhotoEntity } from './entities/photo.entity';
import { groupPhotosByYearMonth, type PhotoWithMetadata } from './group-photos-by-year-month.util';
import {
  createLazyPhotoData,
  type LocalArchiveEntry,
  MAX_READABLE_FILE_SIZE_BYTES,
  readLocalPhotoData,
  scanLocalPhotoDirectory
} from './local-photo-directory.util';
import type { ThumbnailToMerge } from './monthly-archive.util';
import { MonthlyPhotoArchiveService } from './monthly-photo-archive.service';
import { MonthlyPhotoThumbnailArchiveService } from './monthly-photo-thumbnail-archive.service';
import { toPhotoEntity } from './photo-ingest.service';
import { sortPhotosByTakenAt } from './sort-photos-by-taken-at.util';
import { splitPhotosIntoSizedParts } from './split-photos-into-sized-parts.util';
import { resolvePhotoMetadata } from './takeout-metadata.util';
import { matchPhotosWithJsonSidecars } from './takeout-photo-matcher.util';

// 1つの年月をこのバイト数ごとの複数part（zip）へ分割する。動画を多く含む月では
// 元データ＋zip化後のバッファを同時に保持する必要があり、1つの月を丸ごと1つのzipにまとめようとすると
// 実行環境の物理メモリ（実機は16GB）を超えてプロセスが強制終了される不具合が実際に発生した（Issue #23）
const MAX_ARCHIVE_PART_SIZE_BYTES = 1 * 1024 * 1024 * 1024;

// part列が存在しなかった時代（本対応より前）に「その年月の全写真を含む唯一のzip」として作成された
// 既存行を表す特別な値。マイグレーション（AddPartToMonthlyPhotoArchives）が既存行にこの値を設定する。
// これらの年月はサイズに関わらず常に処理済みとして扱い、再分割の対象にしない（Issue #23）
const LEGACY_WHOLE_MONTH_PART = -1;

// console.logはパイプ(tee等)へ出力する際、Node.jsによって非同期にバッファリングされることがあり、
// プロセスが（ハング等により）外部から強制終了された場合、バッファ済みだが未フラッシュのログ行が
// 失われうる。長時間実行され外部要因で停止する可能性があるこのスクリプトでは、どこまで進行したかを
// 確実に追跡できるよう、fs.writeSyncで同期的（かつ即座にフラッシュされる形）にログを出力する
const log = (message: string): void => {
  writeSync(1, `${message}\n`);
};

/**
 * ローカルディレクトリに展開済みの写真＋JSONサイドカーを取り込み、撮影年月ごとの月別アーカイブへ
 * 再構成してphotosテーブルへ保存する。Google Takeoutのzip自体（50GB級）をNode.jsのBuffer上限を
 * 超えてそのまま扱うことができないため、ユーザーが事前にzipを展開しローカルの1フラットディレクトリへ
 * 集約したものを入力とする（Issue #23）。
 * メモリ使用量を抑えるため、写真本体の実バイナリは以下の2箇所でのみその場限りで読み込む。
 *   - メタデータ解決時（`createLazyPhotoData`により、JSONサイドカーが無い/不正な場合のEXIFフォールバックで
 *     実際にdataへアクセスされた時のみ読み込む。JSONで解決できる大多数の写真は本体を一切読み込まない）
 *   - 月別アーカイブへの再構成時（1ヶ月分のグループごとに読み込む。全件を同時には保持しない）
 * 対象件数が多く実行に長時間かかることを想定し、途中で中断され再実行された場合に備えて、
 * `monthly_photo_archives`テーブルに`part: LEGACY_WHOLE_MONTH_PART`のレコードがある年月
 * （＝本対応より前に一括で処理済みの月）は丸ごとスキップする。
 * それ以外の年月は`MAX_ARCHIVE_PART_SIZE_BYTES`ごとの複数partへ分割して処理し、既に
 * レコードがあるpartはスキップする。処理の途中（アップロード直後〜DB保存の間等）で中断された場合、
 * そのpartのレコードが無い・不完全な状態になりうるため、その場合は自動スキップされず再処理される（Issue #23）。
 * `MAX_READABLE_FILE_SIZE_BYTES`（2GiB）を超えるファイル（動画等）は読み込み自体を試みずスキップし、
 * 完了時にパス一覧を出力する（手動での個別対応用）。
 * `thumbnailDirectoryPath`には、事前に`strip-videos-and-generate-thumbnails-locally.ts`で生成済みの
 * サムネイル（元ファイルと同じファイル名）が置かれている前提で、フルサイズzipのアップロードと同じpart単位の
 * ループの中でサムネイルzipへの追記・アップロードも行う（Drive経由の別途ダウンロード往復を無くす、Issue #104）。
 * 対応するサムネイルが見つからない写真（生成失敗等）はサムネイルzipへの追加をスキップし、完了時にパス一覧を出力する
 * @param directoryPath 走査対象のローカルディレクトリパス
 * @param thumbnailDirectoryPath 事前生成済みサムネイルが置かれたローカルディレクトリパス
 */
const backfillPhotosFromLocalDirectory = async (
  directoryPath: string,
  thumbnailDirectoryPath: string
): Promise<void> => {
  const dataSource = new DataSource(createDataSourceOptions(process.env));
  await dataSource.initialize();

  const googleDriveApiClient = new GoogleDriveApiClient(new HttpService());
  const googleDriveAuthService = new GoogleDriveAuthService(googleDriveApiClient, new ConfigService());
  const monthlyPhotoArchiveRepository = dataSource.getRepository(MonthlyPhotoArchiveEntity);
  const monthlyPhotoArchiveService = new MonthlyPhotoArchiveService(
    googleDriveApiClient,
    monthlyPhotoArchiveRepository
  );
  const monthlyPhotoThumbnailArchiveRepository = dataSource.getRepository(MonthlyPhotoThumbnailArchiveEntity);
  const monthlyPhotoThumbnailArchiveService = new MonthlyPhotoThumbnailArchiveService(
    googleDriveApiClient,
    monthlyPhotoThumbnailArchiveRepository
  );
  const photoRepository = dataSource.getRepository(PhotoEntity);

  const { photoEntries, jsonEntries } = scanLocalPhotoDirectory(directoryPath);
  const localEntryByPath = new Map<string, LocalArchiveEntry>(photoEntries.map((entry) => [entry.path, entry]));
  const matched = matchPhotosWithJsonSidecars(photoEntries, jsonEntries);
  log(`${matched.length}件の写真を検出しました`);

  const photosWithMetadata: PhotoWithMetadata[] = [];
  let skippedCount = 0;
  const skippedTooLargePaths: string[] = [];
  for (const { photo, json } of matched) {
    const localEntry = localEntryByPath.get(photo.path);
    if (localEntry === undefined) {
      throw new Error(`写真エントリの読み込みに失敗しました: ${photo.path}`);
    }

    if (statSync(localEntry.absolutePath).size > MAX_READABLE_FILE_SIZE_BYTES) {
      skippedTooLargePaths.push(localEntry.absolutePath);
      continue;
    }

    const metadata = await resolvePhotoMetadata(createLazyPhotoData(localEntry), json);
    if (metadata === null) {
      skippedCount += 1;
      continue;
    }
    photosWithMetadata.push({ entry: { path: photo.path, data: Buffer.alloc(0) }, metadata });
  }
  log(`メタデータを解決しました（保存対象: ${photosWithMetadata.length}件、スキップ: ${skippedCount}件）`);
  if (skippedTooLargePaths.length > 0) {
    log(`2GiB超のため読み込みをスキップしたファイル（${skippedTooLargePaths.length}件）:`);
    for (const path of skippedTooLargePaths) {
      log(`  - ${path}`);
    }
  }

  const groups = groupPhotosByYearMonth(photosWithMetadata);
  const archives = await monthlyPhotoArchiveRepository.find();
  const processedYearMonths = new Set(
    archives.filter((archive) => archive.part === LEGACY_WHOLE_MONTH_PART).map((archive) => archive.yearMonth)
  );
  const processedParts = new Set(archives.map((archive) => `${archive.yearMonth}:${archive.part}`));
  const remainingGroups = groups.filter((group) => !processedYearMonths.has(group.yearMonth));
  log(
    `撮影年月で${groups.length}グループに分類しました（処理済み: ${groups.length - remainingGroups.length}件、未処理: ${remainingGroups.length}件）`
  );

  let savedCount = 0;
  for (const group of groups) {
    if (processedYearMonths.has(group.yearMonth)) {
      log(`[${group.yearMonth}] 前回の実行で処理済みのためスキップします`);
      continue;
    }

    const photoSizeBytesByPath = new Map(
      group.photos.map((photo) => {
        const localEntry = localEntryByPath.get(photo.entry.path);
        if (localEntry === undefined) {
          throw new Error(`写真エントリの読み込みに失敗しました: ${photo.entry.path}`);
        }
        return [photo.entry.path, statSync(localEntry.absolutePath).size];
      })
    );
    // 撮影日時の昇順に並び替えてからpart分割することで、part番号が撮影日時の連続性を保つようにする
    // （scanLocalPhotoDirectoryのreaddirSyncはファイルシステムの列挙順であり撮影日時とは無関係なため。Issue #91）
    const parts = splitPhotosIntoSizedParts(
      sortPhotosByTakenAt(group.photos),
      (photo) => photoSizeBytesByPath.get(photo.entry.path) ?? 0,
      MAX_ARCHIVE_PART_SIZE_BYTES
    );

    for (const [partIndex, partPhotos] of parts.entries()) {
      if (processedParts.has(`${group.yearMonth}:${partIndex}`)) {
        log(`[${group.yearMonth} part${partIndex}] 前回の実行で処理済みのためスキップします`);
        continue;
      }

      // 対象件数が多いと全体の実行に長時間かかりアクセストークンが失効しうるため、partごとに取得し直す
      // （GoogleDriveAuthServiceが有効期限内であればキャッシュを返すため、都度呼び出すコストは小さい）
      const accessToken = await googleDriveAuthService.getAccessToken();

      const groupWithData = {
        yearMonth: group.yearMonth,
        part: partIndex,
        photos: partPhotos.map((photo) => {
          const localEntry = localEntryByPath.get(photo.entry.path);
          if (localEntry === undefined) {
            throw new Error(`写真エントリの読み込みに失敗しました: ${photo.entry.path}`);
          }
          return { entry: readLocalPhotoData(localEntry), metadata: photo.metadata };
        })
      };

      const totalBytes = groupWithData.photos.reduce((sum, photo) => sum + photo.entry.data.length, 0);
      const totalMebibytes = (totalBytes / (1024 * 1024)).toFixed(1);
      log(
        `[${group.yearMonth} part${partIndex}] 処理開始（写真${groupWithData.photos.length}件、合計約${totalMebibytes}MiB）`
      );

      const reorganized = await monthlyPhotoArchiveService.reorganize(accessToken, [groupWithData]);
      log(`[${group.yearMonth} part${partIndex}] Google Driveへの振り分け・アップロードが完了しました`);
      const entities = reorganized.map((photo) => toPhotoEntity(photo));
      if (entities.length > 0) {
        await photoRepository.save(entities);
        savedCount += entities.length;
      }
      log(`[${group.yearMonth} part${partIndex}] ${entities.length}件を月別アーカイブへ振り分け・保存しました`);

      const thumbnails: ThumbnailToMerge[] = [];
      const missingThumbnailPaths: string[] = [];
      for (const entry of reorganized) {
        const thumbnailPath = join(thumbnailDirectoryPath, entry.photo.entry.path);
        if (!existsSync(thumbnailPath)) {
          missingThumbnailPaths.push(entry.photo.entry.path);
          continue;
        }
        thumbnails.push({ archivePath: entry.archivePath, buffer: readFileSync(thumbnailPath) });
      }
      await monthlyPhotoThumbnailArchiveService.appendThumbnails(accessToken, group.yearMonth, thumbnails);
      log(`[${group.yearMonth} part${partIndex}] ${thumbnails.length}件をサムネイルアーカイブへ追記・保存しました`);
      if (missingThumbnailPaths.length > 0) {
        log(
          `[${group.yearMonth} part${partIndex}] サムネイルが見つからずスキップしたファイル（${missingThumbnailPaths.length}件）: ${missingThumbnailPaths.join(', ')}`
        );
      }
    }
  }

  await dataSource.destroy();
  log(
    `完了しました（保存: ${savedCount}件、スキップ: ${skippedCount}件、2GiB超によりスキップ: ${skippedTooLargePaths.length}件）`
  );
};

// `pnpm --filter <package> run <script> -- <args>`はnpm scriptsと異なり、区切りの`--`自体を
// 除去せずそのままprocess.argvへ渡すため、位置引数を取り出す前に取り除いておく
const [directoryPath, thumbnailDirectoryPath] = process.argv.slice(2).filter((arg) => arg !== '--');
if (directoryPath === undefined || thumbnailDirectoryPath === undefined) {
  console.error(
    '使い方: ts-node src/photos/backfill-photos-from-local.ts <ローカルディレクトリパス> <サムネイルディレクトリパス>'
  );
  process.exitCode = 1;
} else {
  backfillPhotosFromLocalDirectory(directoryPath, thumbnailDirectoryPath).catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
