import 'dotenv/config';
import { closeSync, fstatSync, mkdtempSync, openSync, readSync, rmSync, writeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { DataSource, In } from 'typeorm';
import yazl from 'yazl';
import { createDataSourceOptions } from '../../../database/database.config';
import { GoogleDriveApiClient } from '../../../google-drive/google-drive-api.client';
import { GoogleDriveAuthService } from '../../../google-drive/google-drive-auth.service';
import { MonthlyPhotoArchiveEntity } from '../../../photos/entities/monthly-photo-archive.entity';
import { PhotoEntity } from '../../../photos/entities/photo.entity';
import { writeYazlOutput } from '../../../photos/zip-streaming.util';
import {
  decompressAndVerifyEntry,
  type RecoveredZipEntry,
  scanLocalFileHeaders
} from './utils/legacy-archive-recovery.util';

// part列が存在しなかった時代の「その年月の全写真を含む唯一のzip」を表す特別な値
// (strip-videos-and-consolidate-archives.tsのLEGACY_WHOLE_MONTH_PARTと同じ意味)
const LEGACY_WHOLE_MONTH_PART = -1;

// Issue #99実データ処理で確定した、ZIP64非対応により破損した9年月とそのDriveファイルID
// (legacy_archive_zip64_corruption参照、2026-07-25確定)。この9件は今後増減しない既知の
// 固定リストであるため、DBから動的に検出するのではなくハードコードする
const CORRUPTED_ARCHIVES: { yearMonth: string; driveFileId: string }[] = [
  { yearMonth: '2020-09', driveFileId: '1Tsyp_5ki7YEDC-jBakta9xQsnBMZHFyu' },
  { yearMonth: '2024-02', driveFileId: '1pFnSk6N3dkNOEi4jaO292dLjqcBfQVMO' },
  { yearMonth: '2024-03', driveFileId: '1Qc21KaiCvPF01klcSkHBZq4ckSKqeZtp' },
  { yearMonth: '2024-08', driveFileId: '1rBMwX01YeX3nD4JiMIHiFpC1eQekvqrp' },
  { yearMonth: '2024-11', driveFileId: '1xJW4zWjFBxMzdCZN2zz4rKuimtsSWFq-' },
  { yearMonth: '2025-03', driveFileId: '1rHQS4cFoEfdJS6gWr-o36EJAHXOIHReR' },
  { yearMonth: '2025-04', driveFileId: '1s68bXbFzYZ3nhhTX87uSlCUNyGK8wVsN' },
  { yearMonth: '2025-05', driveFileId: '1ZN6F-3IflRaTavbWKNkR4xZb9_o93ScU' },
  { yearMonth: '2025-11', driveFileId: '1OEmzmPnnZSzppLxMkaxsoH3HHCnLbuyW' }
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
 * ファイルディスクリプタから指定範囲を読み取る。要求したlengthに満たない場合(ファイル末尾)は
 * 読み取れた分だけのBufferを返す
 */
const readRangeFromFd = (fd: number, offset: number, length: number): Buffer => {
  const buffer = Buffer.alloc(length);
  const bytesRead = readSync(fd, buffer, 0, length, offset);
  return bytesRead === length ? buffer : buffer.subarray(0, bytesRead);
};

/** recoverArchiveの戻り値のうち、検証に失敗して復旧できなかった1エントリ分 */
export type RecoveryFailedEntry = {
  /** アーカイブ内でのファイル名 */
  fileName: string;
  /** 失敗理由（エラーメッセージ） */
  reason: string;
};

/** recoverArchiveの戻り値 */
export type RecoverArchiveResult = {
  /** 復旧に成功したファイル名の一覧 */
  recoveredFileNames: string[];
  /** 検証に失敗し復旧できなかったエントリの一覧（元のDriveファイルのまま残る） */
  failedEntries: RecoveryFailedEntry[];
  /** ローカルファイルヘッダーの走査を止めた理由 */
  scanStopReason: string;
};

/**
 * Node.jsのfs.readFileSyncの2GiB上限（Issue #23で既知）を回避するため、ファイルディスクリプタで
 * 指定範囲のみを読み取る。単体テスト（legacy-archive-recovery.util.tests.ts）でカバーしている
 * scanLocalFileHeaders・decompressAndVerifyEntry自体はBuffer/コールバックで抽象化されており
 * 巨大ファイルに依存しないため、本関数（実ファイルとの結合部分）は対象外とする
 * （スタンドアロンCLIスクリプトのオーケストレーション部分は専用テストを持たない、test_rules.md参照）。
 *
 * 全エントリの検証（decompressAndVerifyEntry）を先に完了させてから出力zipの書き込みを開始する
 * 3パス構成にしている（1: 検証のみ、2: 検証に成功したエントリのみ再読み込みして書き込み）。
 * 検証と書き込みを1パスで同時に進める設計だと、途中のエントリで検証エラーが発生した場合に、
 * 既に開始済みのyazl出力ストリーム（`writeYazlOutput`が返すPromise）が中途半端な状態のまま
 * 残ってしまう。実際に、検証失敗時にこの中途半端なPromiseが後から`ENOENT`でreject され、
 * どこにもcatchされない「unhandled promise rejection」としてプロセス全体をクラッシュさせる
 * 事故が発生した（1件のエントリの検証失敗が原因で、他の年月の処理まで巻き込んで停止してしまった）。
 * また、1件でも検証に失敗したエントリがあった場合でも、その年月全体を諦めるのではなく、検証に
 * 成功した他のエントリは復旧して`photos.source_file_id`を更新する（失敗したエントリのみ元の
 * （読めない）Driveファイルを指したまま残り、手動確認が必要な状態として明示的に報告される）。
 * 検証結果を一時的に保持する`recoverableEntries`はアーカイブ全体のバイナリではなくメタデータ
 * （ファイル名・オフセット・サイズ等）のみのため、9GiB級のアーカイブでもメモリ使用量は小さい
 * @param sourcePath 復旧対象の破損アーカイブ（ディスク上のファイルパス）
 * @param destPath 復旧後アーカイブの出力先パス
 * @returns 復旧結果
 */
const recoverArchive = async (sourcePath: string, destPath: string): Promise<RecoverArchiveResult> => {
  const fd = openSync(sourcePath, 'r');
  try {
    const totalSize = fstatSync(fd).size;
    const scanResult = scanLocalFileHeaders((offset, length) => readRangeFromFd(fd, offset, length), totalSize);

    const recoverableEntries: RecoveredZipEntry[] = [];
    const failedEntries: RecoveryFailedEntry[] = [];

    for (const entry of scanResult.entries) {
      try {
        const compressed = readRangeFromFd(fd, entry.dataOffset, entry.compressedSize);
        decompressAndVerifyEntry(compressed, entry);
        recoverableEntries.push(entry);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        console.error(`[legacy-archive-recovery] ${entry.fileName}の検証に失敗しました:`, error);
        failedEntries.push({ fileName: entry.fileName, reason });
      }
    }

    const outputZip = new yazl.ZipFile();
    const writePromise = writeYazlOutput(outputZip, destPath);

    for (const entry of recoverableEntries) {
      const compressed = readRangeFromFd(fd, entry.dataOffset, entry.compressedSize);
      const decompressed = decompressAndVerifyEntry(compressed, entry);
      outputZip.addBuffer(decompressed, entry.fileName, { compress: false });
    }

    outputZip.end();
    await writePromise;

    return {
      recoveredFileNames: recoverableEntries.map((entry) => entry.fileName),
      failedEntries,
      scanStopReason: scanResult.stopReason
    };
  } finally {
    closeSync(fd);
  }
};

/**
 * Issue #99実データ処理で判明した、ZIP64非対応により破損した9年月のレガシー単一アーカイブから、
 * ローカルファイルヘッダーを直接走査してエントリを復旧し、正しいセントラルディレクトリを持つ
 * 新しいzipへ再構築してGoogle Driveへアップロードする。
 * これらのアーカイブはEnd of Central Directoryが欠落・破損しておりyauzl/unzip/adm-zipいずれでも
 * 読めないが、各エントリの位置・サイズ自体はローカルファイルヘッダーに残っているため、
 * データそのものは失われていない（2026-07-28、2025-05での実データ検証で確認済み。733件全て
 * CRC32一致）。
 * 復旧後、`photos.source_file_id`を新しいDriveファイルIDへ更新し、`monthly_photo_archives`を
 * 新しいアーカイブを指すよう更新する（`archive_path`はファイル名そのままのため変更不要）。
 * 古い（読めない）Driveファイルは、復旧結果の最終確認が済むまでの安全策としてこのスクリプトでは
 * 削除しない（手動確認後に別途削除する）。
 * 1つの年月の処理に失敗しても、他の年月の処理を止めずに次へ進む
 */
const recoverLegacyArchives = async (): Promise<void> => {
  const dataSource = new DataSource(createDataSourceOptions(process.env));
  await dataSource.initialize();

  const googleDriveApiClient = new GoogleDriveApiClient(new HttpService());
  const googleDriveAuthService = new GoogleDriveAuthService(googleDriveApiClient, new ConfigService());
  const monthlyPhotoArchiveRepository = dataSource.getRepository(MonthlyPhotoArchiveEntity);
  const photoRepository = dataSource.getRepository(PhotoEntity);

  let processedCount = 0;
  let skippedCount = 0;
  const failedYearMonths: string[] = [];

  for (const { yearMonth, driveFileId: originalDriveFileId } of CORRUPTED_ARCHIVES) {
    const currentArchive = await monthlyPhotoArchiveRepository.findOneBy({ yearMonth });
    if (currentArchive === null || currentArchive.driveFileId !== originalDriveFileId) {
      log(`[${yearMonth}] 既に復旧済み(driveFileIdが元の破損ファイルと異なる)のためスキップします`);
      skippedCount += 1;
      continue;
    }

    try {
      const accessToken = await googleDriveAuthService.getAccessToken();
      log(`[${yearMonth}] 処理開始`);

      const expectedPhotoCount = await photoRepository.count({ where: { sourceFileId: originalDriveFileId } });
      log(`[${yearMonth}] photosテーブル上の期待件数: ${expectedPhotoCount}件`);

      const workDir = mkdtempSync(join(tmpdir(), `recover-${yearMonth}-`));
      try {
        const sourcePath = join(workDir, 'source.zip');
        await googleDriveApiClient.downloadFileToPath(accessToken, originalDriveFileId, sourcePath);

        const destPath = join(workDir, 'recovered.zip');
        const { recoveredFileNames, failedEntries, scanStopReason } = await recoverArchive(sourcePath, destPath);
        log(
          `[${yearMonth}] ${recoveredFileNames.length}件のエントリを復旧しました` +
            `(検証失敗: ${failedEntries.length}件、走査終了理由: ${scanStopReason})`
        );
        if (failedEntries.length > 0) {
          log(
            `[${yearMonth}] 検証に失敗し復旧できなかったファイル（元のDriveファイルのまま残ります、手動確認が必要）: ` +
              failedEntries.map((entry) => `${entry.fileName}(${entry.reason})`).join(', ')
          );
        }
        if (recoveredFileNames.length + failedEntries.length !== expectedPhotoCount) {
          log(
            `[${yearMonth}] [警告] 走査で検出した合計件数(${recoveredFileNames.length + failedEntries.length})が` +
              `photosテーブルの期待件数(${expectedPhotoCount})と一致しません。走査終了理由(${scanStopReason})を確認してください`
          );
        }
        if (recoveredFileNames.length === 0) {
          throw new Error('検証に成功したエントリが1件も無かったため、この年月の復旧は行いません');
        }

        const newDriveFileId = await googleDriveApiClient.createFileMetadata(accessToken, `${yearMonth}.zip`);
        await googleDriveApiClient.uploadFileFromPath(accessToken, newDriveFileId, destPath);
        log(`[${yearMonth}] 復旧後アーカイブのアップロードが完了しました(新Drive ID: ${newDriveFileId})`);

        await dataSource.transaction(async (manager) => {
          await manager.update(
            PhotoEntity,
            { sourceFileId: originalDriveFileId, archivePath: In(recoveredFileNames) },
            { sourceFileId: newDriveFileId }
          );
          await manager.delete(MonthlyPhotoArchiveEntity, { yearMonth });
          await manager.save(MonthlyPhotoArchiveEntity, {
            yearMonth,
            part: LEGACY_WHOLE_MONTH_PART,
            driveFileId: newDriveFileId
          });
        });

        log(
          `[${yearMonth}] 完了しました（復旧できた${recoveredFileNames.length}件のphotos.source_file_idを更新、` +
            `monthly_photo_archivesを新アーカイブへ差し替え）。古いDriveファイル(${originalDriveFileId})は` +
            `安全確認のため削除せず残しています`
        );
        processedCount += 1;
      } finally {
        rmSync(workDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.error(`[${yearMonth}] 処理に失敗したため、この年月をスキップして次へ進みます:`, error);
      failedYearMonths.push(yearMonth);
    }
  }

  await dataSource.destroy();
  log(`完了しました（復旧済み: ${processedCount}件、スキップ: ${skippedCount}件、失敗: ${failedYearMonths.length}件）`);
  if (failedYearMonths.length > 0) {
    log('復旧に失敗した年月（手動確認が必要）:');
    for (const yearMonth of failedYearMonths) {
      log(`  - ${yearMonth}`);
    }
  }
};

recoverLegacyArchives().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
