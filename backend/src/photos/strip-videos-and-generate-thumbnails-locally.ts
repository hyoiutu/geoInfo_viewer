import 'dotenv/config';
import { appendFileSync, mkdirSync, readFileSync, unlinkSync, writeFileSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import { assertHeifConvertAvailable } from './heic-conversion.util';
import { isFileTooLargeToRead, scanLocalPhotoDirectory } from './local-photo-directory.util';
import { isLocalFileVideo } from './local-video-detection.util';
import { extractMetadataFromExif } from './takeout-metadata.util';
import { generateThumbnailBuffer } from './thumbnail-generation.util';
import { formatVideoDeletionLogLine } from './video-deletion-log.util';

// console.logはパイプ経由の出力時にNode.jsによって非同期にバッファリングされ、外部要因でプロセスが
// 停止した場合に未フラッシュの行が失われうるため、fs.writeSyncで同期的にログを出力する
// （backfill-photos-from-local.tsと同じ対策、Issue #23）
const log = (message: string): void => {
  writeSync(1, `${message}\n`);
};

/**
 * 動画ファイル1件から、削除ログ記録用の撮影日時をEXIFから抽出する。`isFileTooLargeToRead`
 * （2GiB超過判定、`local-photo-directory.util.ts`）に該当する動画は読み込み自体を試みない
 * （`extractMetadataFromExif`のNode.js Buffer上限対策、`backfill-photos-from-local.ts`と
 * 同じ制約を共通のutilとして参照）。EXIFが無い・パース失敗の場合も含め、いずれの場合も
 * ベストエフォートでnullを返し、削除処理自体は継続する（Issue #104の検討事項「結論」に基づき、
 * 削除ログの撮影日時はEXIF撮影日時のみを使う。JSONサイドカーは動画に対して用意されないことが多く、
 * また削除自体は動画判定ロジックのみで完結すべきため参照しない）
 * @param absolutePath 動画ファイルの絶対パス
 * @returns 抽出できた撮影日時。抽出できない場合はnull
 */
const resolveVideoTakenAtForLog = async (absolutePath: string): Promise<Date | null> => {
  if (isFileTooLargeToRead(absolutePath)) {
    return null;
  }
  const metadata = await extractMetadataFromExif(readFileSync(absolutePath));
  return metadata?.takenAt ?? null;
};

/**
 * `flatten-local-photo-directory.ts`で集約済みのローカルフラットディレクトリに対し、
 * `backfill-photos-from-local.ts`でGoogle Driveへアップロードする前に、動画ファイルの削除と
 * サムネイル生成を行う（Issue #104）。動画削除・サムネイル生成の判断自体はこの時点で確定できるため、
 * 従来の「動画込みで一度アップロード→ダウンロードして動画削除→再アップロード」という無駄な往復
 * （Issue #97/#99/#100）を新規取り込み分では発生させないようにする。
 * 動画かどうかの判定（`isLocalFileVideo`）は既存の`isVideoFile`・`looksLikeVideoContainer`
 * （`video-file.util.ts`）をそのまま流用する。判定して削除した動画は、ファイル名とEXIF撮影日時を
 * `deletionLogPath`へJSON Lines形式で追記する。ローカルのTakeout展開データは基本的に保持しない運用の
 * ため、誤って写真を動画と判定し削除してしまった場合、このログがGoogle Photos側での検索・復旧の
 * 唯一の手がかりになる（Issue #104の検討事項「結論（2026-07-30）」参照）。
 * サムネイルは`thumbnailDirectoryPath`へ元ファイルと同じファイル名で書き出す（内容はJPEG等へ
 * 再エンコードされるが、`backfill-photos-from-local.ts`側でフルサイズzip内のアーカイブパスと
 * 対応付けるためファイル名は変更しない）。
 * 1件の写真のサムネイル生成に失敗しても、他のファイルの処理を止めずに次へ進む
 * （`generate-thumbnail-archive-streaming.util.ts`と同じ設計、Issue #100フォローアップ）。
 * 実行前に必ず`assertHeifConvertAvailable`でheif-convertの可用性を確認する
 * （確認に失敗した場合の事故防止の理由は`heic-conversion.util.ts`のTSDoc参照）
 * @param flatDirectoryPath 処理対象のローカルフラットディレクトリパス（動画は削除、写真はそのまま残す）
 * @param thumbnailDirectoryPath 生成したサムネイルの出力先ディレクトリパス（無ければ作成する）
 * @param deletionLogPath 削除した動画の記録先ログファイルパス（追記型、無ければ作成する）
 */
const stripVideosAndGenerateThumbnailsLocally = async (
  flatDirectoryPath: string,
  thumbnailDirectoryPath: string,
  deletionLogPath: string
): Promise<void> => {
  assertHeifConvertAvailable();
  mkdirSync(thumbnailDirectoryPath, { recursive: true });

  const { photoEntries } = scanLocalPhotoDirectory(flatDirectoryPath);
  log(`${photoEntries.length}件のファイルを検出しました`);

  let deletedVideoCount = 0;
  let generatedThumbnailCount = 0;
  const failedThumbnailPaths: string[] = [];

  for (const entry of photoEntries) {
    if (isLocalFileVideo(entry.absolutePath, entry.path)) {
      const takenAt = await resolveVideoTakenAtForLog(entry.absolutePath);
      appendFileSync(deletionLogPath, formatVideoDeletionLogLine({ fileName: entry.path, takenAt }));
      unlinkSync(entry.absolutePath);
      deletedVideoCount += 1;
      continue;
    }

    try {
      const originalBuffer = readFileSync(entry.absolutePath);
      const thumbnailBuffer = await generateThumbnailBuffer(originalBuffer, entry.path);
      writeFileSync(join(thumbnailDirectoryPath, entry.path), thumbnailBuffer);
      generatedThumbnailCount += 1;
    } catch (error) {
      console.error(`[thumbnail] ${entry.path}のサムネイル生成に失敗したためスキップします:`, error);
      failedThumbnailPaths.push(entry.path);
    }
  }

  log(
    `完了しました（削除した動画: ${deletedVideoCount}件、生成したサムネイル: ${generatedThumbnailCount}件、サムネイル生成に失敗: ${failedThumbnailPaths.length}件）`
  );
  if (failedThumbnailPaths.length > 0) {
    log('サムネイル生成に失敗したファイル（手動確認が必要）:');
    for (const path of failedThumbnailPaths) {
      log(`  - ${path}`);
    }
  }
};

// `pnpm --filter <package> run <script> -- <args>`はnpm scriptsと異なり、区切りの`--`自体を
// 除去せずそのままprocess.argvへ渡すため、位置引数を取り出す前に取り除いておく
const [flatDirectoryPath, thumbnailDirectoryPath, deletionLogPath] = process.argv
  .slice(2)
  .filter((arg) => arg !== '--');
if (flatDirectoryPath === undefined || thumbnailDirectoryPath === undefined || deletionLogPath === undefined) {
  console.error(
    '使い方: ts-node src/photos/strip-videos-and-generate-thumbnails-locally.ts <フラットディレクトリパス> <サムネイル出力先ディレクトリパス> <削除ログ出力先パス>'
  );
  process.exitCode = 1;
} else {
  stripVideosAndGenerateThumbnailsLocally(flatDirectoryPath, thumbnailDirectoryPath, deletionLogPath).catch(
    (error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    }
  );
}
