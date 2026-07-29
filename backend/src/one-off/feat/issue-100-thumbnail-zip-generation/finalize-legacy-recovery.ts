import 'dotenv/config';
import { mkdtempSync, readFileSync, rmSync, writeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import { DataSource } from 'typeorm';
import yazl from 'yazl';
import { createDataSourceOptions } from '../../../database/database.config';
import { GoogleDriveApiClient } from '../../../google-drive/google-drive-api.client';
import { GoogleDriveAuthService } from '../../../google-drive/google-drive-auth.service';
import { MonthlyPhotoArchiveEntity } from '../../../photos/entities/monthly-photo-archive.entity';
import { MonthlyPhotoThumbnailArchiveEntity } from '../../../photos/entities/monthly-photo-thumbnail-archive.entity';
import { PhotoEntity } from '../../../photos/entities/photo.entity';
import { THUMBNAIL_WIDTH_PX } from '../../../photos/generate-thumbnail-archive-streaming.util';
import {
  forEachZipEntry,
  openEntryReadStream,
  readStreamToBuffer,
  writeYazlOutput
} from '../../../photos/zip-streaming.util';

// legacy_archive_zip64_corruptionの復旧(recover-legacy-archives.ts)で検証に失敗し復旧できなかった
// 9件のうち、写真5件。外付けHDD（写真ローカルバックフィル時の元データ）上で正常な状態を確認できたため、
// 各年月の（動画削除・サムネイル生成済みの）現行アーカイブへ追加する（2026-07-29、ユーザー確認済み）
const RECOVERED_PHOTOS: { yearMonth: string; fileName: string; hddPath: string; oldDriveFileId: string }[] = [
  {
    yearMonth: '2024-03',
    fileName: 'IMG20240314085527.jpg',
    hddPath: '/Volumes/Elements/GooglePhoto_backup_20260715/flatten/IMG20240314085527.jpg',
    oldDriveFileId: '1Qc21KaiCvPF01klcSkHBZq4ckSKqeZtp'
  },
  {
    yearMonth: '2024-08',
    fileName: 'IMG20240820102842.jpg',
    hddPath: '/Volumes/Elements/GooglePhoto_backup_20260715/flatten/IMG20240820102842.jpg',
    oldDriveFileId: '1rBMwX01YeX3nD4JiMIHiFpC1eQekvqrp'
  },
  {
    yearMonth: '2025-04',
    fileName: 'IMG20250430081452.jpg',
    hddPath: '/Volumes/Elements/GooglePhoto_backup_20260715/flatten/IMG20250430081452.jpg',
    oldDriveFileId: '1s68bXbFzYZ3nhhTX87uSlCUNyGK8wVsN'
  },
  {
    yearMonth: '2025-05',
    fileName: 'IMG20250501111123.jpg',
    hddPath: '/Volumes/Elements/GooglePhoto_backup_20260715/flatten/IMG20250501111123.jpg',
    oldDriveFileId: '1ZN6F-3IflRaTavbWKNkR4xZb9_o93ScU'
  },
  {
    yearMonth: '2025-11',
    fileName: 'IMG20251108083222.jpg',
    hddPath: '/Volumes/Elements/GooglePhoto_backup_20260715/flatten/IMG20251108083222.jpg',
    oldDriveFileId: '1OEmzmPnnZSzppLxMkaxsoH3HHCnLbuyW'
  }
];

// 同じ9件のうち、動画4件。動画は元々グリッド表示に使われず`strip-videos-and-consolidate-archives.ts`で
// 削除される対象のため、復旧を試みず`photos`テーブルの行のみ削除する
// （`sourceFileId`は元の破損した（読めない）Driveファイルを指したまま残っていたもの）
const FAILED_VIDEOS_TO_DELETE: { yearMonth: string; fileName: string; oldDriveFileId: string }[] = [
  { yearMonth: '2020-09', fileName: 'IMG_6294.MOV', oldDriveFileId: '1Tsyp_5ki7YEDC-jBakta9xQsnBMZHFyu' },
  { yearMonth: '2024-02', fileName: 'VID20240204082306.mp4', oldDriveFileId: '1pFnSk6N3dkNOEi4jaO292dLjqcBfQVMO' },
  { yearMonth: '2024-11', fileName: 'VID20241102153310.mp4', oldDriveFileId: '1xJW4zWjFBxMzdCZN2zz4rKuimtsSWFq-' },
  { yearMonth: '2025-03', fileName: 'VID20250307190340.mp4', oldDriveFileId: '1rHQS4cFoEfdJS6gWr-o36EJAHXOIHReR' }
];

/**
 * 標準出力へ同期的にログを出力する（`console.log`は外部要因でプロセスが停止した場合に
 * バッファ済みだが未フラッシュの行が失われうるため、`fs.writeSync`を使う。他のオーケストレーション
 * スクリプトと同じ対策、Issue #23）
 * @param message 出力するメッセージ
 */
const log = (message: string): void => {
  writeSync(1, `${message}\n`);
};

/**
 * ディスク上の元アーカイブzipの全エントリを読み込んだ上で、新しいエントリを1件追加し、
 * ディスク上に新しいzipとして書き出す
 * @param sourceZipPath 元アーカイブ（ディスク上のファイルパス）
 * @param destZipPath 生成する新アーカイブの出力先パス
 * @param newEntry 追加する新しいエントリ（ファイル名とバイト列）
 */
const addEntryToArchive = async (
  sourceZipPath: string,
  destZipPath: string,
  newEntry: { fileName: string; buffer: Buffer }
): Promise<void> => {
  const outputZip = new yazl.ZipFile();
  const writePromise = writeYazlOutput(outputZip, destZipPath);

  await forEachZipEntry(sourceZipPath, async (zipFile, entry) => {
    if (entry.fileName.endsWith('/')) {
      return;
    }
    const readStream = await openEntryReadStream(zipFile, entry);
    const buffer = await readStreamToBuffer(readStream);
    outputZip.addBuffer(buffer, entry.fileName, { compress: false });
  });

  outputZip.addBuffer(newEntry.buffer, newEntry.fileName, { compress: false });

  outputZip.end();
  await writePromise;
};

/**
 * 外部HDD上で正常性を確認済みの復旧写真5件を各年月の現行アーカイブ・サムネイルアーカイブへ追加し、
 * `photos.source_file_id`を新アーカイブへ更新する。あわせて、復旧を試みない動画4件の`photos`行を
 * 削除する（Issue #99フォローアップ、legacy_archive_zip64_corruptionの最終後始末）
 */
const finalizeLegacyRecovery = async (): Promise<void> => {
  const dataSource = new DataSource(createDataSourceOptions(process.env));
  await dataSource.initialize();

  const googleDriveApiClient = new GoogleDriveApiClient(new HttpService());
  const googleDriveAuthService = new GoogleDriveAuthService(googleDriveApiClient, new ConfigService());
  const monthlyPhotoArchiveRepository = dataSource.getRepository(MonthlyPhotoArchiveEntity);
  const thumbnailArchiveRepository = dataSource.getRepository(MonthlyPhotoThumbnailArchiveEntity);
  const photoRepository = dataSource.getRepository(PhotoEntity);

  for (const { yearMonth, fileName, hddPath, oldDriveFileId } of RECOVERED_PHOTOS) {
    log(`[${yearMonth}] ${fileName}を追加します`);
    const accessToken = await googleDriveAuthService.getAccessToken();

    const archive = await monthlyPhotoArchiveRepository.findOneBy({ yearMonth });
    const thumbnailArchive = await thumbnailArchiveRepository.findOneBy({ yearMonth });
    if (archive === null || thumbnailArchive === null) {
      throw new Error(`[${yearMonth}] monthly_photo_archives/monthly_photo_thumbnail_archivesが見つかりません`);
    }

    const workDir = mkdtempSync(join(tmpdir(), `finalize-recovery-${yearMonth}-`));
    try {
      const originalBuffer = readFileSync(hddPath);

      // フルサイズアーカイブへの追加
      const sourcePath = join(workDir, 'source.zip');
      await googleDriveApiClient.downloadFileToPath(accessToken, archive.driveFileId, sourcePath);
      const destPath = join(workDir, 'updated.zip');
      await addEntryToArchive(sourcePath, destPath, { fileName, buffer: originalBuffer });
      const newDriveFileId = await googleDriveApiClient.createFileMetadata(accessToken, `${yearMonth}.zip`);
      await googleDriveApiClient.uploadFileFromPath(accessToken, newDriveFileId, destPath);

      // サムネイルアーカイブへの追加
      const thumbnailBuffer = await sharp(originalBuffer).resize({ width: THUMBNAIL_WIDTH_PX }).toBuffer();
      const thumbnailSourcePath = join(workDir, 'thumbnails-source.zip');
      await googleDriveApiClient.downloadFileToPath(accessToken, thumbnailArchive.driveFileId, thumbnailSourcePath);
      const thumbnailDestPath = join(workDir, 'thumbnails-updated.zip');
      await addEntryToArchive(thumbnailSourcePath, thumbnailDestPath, { fileName, buffer: thumbnailBuffer });
      const newThumbnailDriveFileId = await googleDriveApiClient.createFileMetadata(
        accessToken,
        `${yearMonth}-thumbnails.zip`
      );
      await googleDriveApiClient.uploadFileFromPath(accessToken, newThumbnailDriveFileId, thumbnailDestPath);

      await dataSource.transaction(async (manager) => {
        const updateResult = await manager.update(
          PhotoEntity,
          { archivePath: fileName, sourceFileId: oldDriveFileId },
          { sourceFileId: newDriveFileId }
        );
        if (updateResult.affected !== 1) {
          throw new Error(
            `[${yearMonth}] photos.source_file_idの更新件数が1件ではありません(${updateResult.affected ?? 0}件)。手動確認が必要です`
          );
        }
        await manager.delete(MonthlyPhotoArchiveEntity, { yearMonth });
        await manager.save(MonthlyPhotoArchiveEntity, {
          yearMonth,
          part: archive.part,
          driveFileId: newDriveFileId
        });
        await manager.delete(MonthlyPhotoThumbnailArchiveEntity, { yearMonth });
        await manager.save(MonthlyPhotoThumbnailArchiveEntity, { yearMonth, driveFileId: newThumbnailDriveFileId });
      });

      for (const oldId of [archive.driveFileId, thumbnailArchive.driveFileId]) {
        try {
          await googleDriveApiClient.deleteFile(accessToken, oldId);
        } catch (error) {
          console.error(`[${yearMonth}] 古いアーカイブ（${oldId}）の削除に失敗しました:`, error);
        }
      }

      log(`[${yearMonth}] ${fileName}の追加が完了しました`);
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  }

  for (const { yearMonth, fileName, oldDriveFileId } of FAILED_VIDEOS_TO_DELETE) {
    const result = await photoRepository.delete({ archivePath: fileName, sourceFileId: oldDriveFileId });
    log(`[${yearMonth}] ${fileName}のphotos行を削除しました（削除件数: ${result.affected ?? 0}）`);
  }

  await dataSource.destroy();
  log('完了しました');
};

finalizeLegacyRecovery().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
