import { basename } from 'node:path';
import yazl from 'yazl';
import { resolveUniquePath } from './monthly-archive.util';
import { generateThumbnailBuffer, THUMBNAIL_WIDTH_PX } from './thumbnail-generation.util';
import { isVideoFile, looksLikeVideoContainer } from './video-file.util';
import { forEachZipEntry, openEntryReadStream, readStreamToBuffer, writeYazlOutput } from './zip-streaming.util';

export { THUMBNAIL_WIDTH_PX };

/** generateThumbnailArchiveStreamingの戻り値のうち、生成したサムネイル1件分 */
export type ThumbnailArchiveEntry = {
  /** サムネイルzip内でのエントリパス（元アーカイブと同じファイル名。衝突時は連番を付ける） */
  archivePath: string;
};

/** generateThumbnailArchiveStreamingの戻り値のうち、サムネイル生成に失敗した1件分 */
export type FailedThumbnailEntry = {
  /** 元アーカイブ内でのエントリパス */
  archivePath: string;
  /** 失敗理由（エラーメッセージ） */
  reason: string;
};

/** generateThumbnailArchiveStreamingの戻り値 */
export type GenerateThumbnailArchiveResult = {
  entries: ThumbnailArchiveEntry[];
  failedEntries: FailedThumbnailEntry[];
};

/**
 * 動画削除・part統合済み（Issue #97 / #99）の月別アーカイブzip（ディスク上のパス）を読み込み、
 * 各写真エントリを横`THUMBNAIL_WIDTH_PX`px・縦横比維持でリサイズしたサムネイルzipを、
 * ディスク上に生成する（Issue #100）。
 *
 * 元アーカイブ側の読み込みはエントリ単位のストリーミング（`zip-streaming.util.ts`）で行い
 * アーカイブ全体を同時にメモリへ保持しないが、1エントリ分（写真1件、数MB程度）は`generateThumbnailBuffer`
 * （`thumbnail-generation.util.ts`、HEIC変換・sharpでのリサイズを担う共通処理）でのリサイズのために
 * いったんBufferとして読み切ってから処理する。これは、yazlの出力ストリームへ追加した後に読み込み側で
 * エラーが発生すると、yazlの内部キューが後続エントリの書き込みへ進めなくなる恐れがあるため。この失敗を
 * 出力zipへ触れる前（yazlへ登録する前）に検知できるよう、Buffer化してから`generateThumbnailBuffer`が
 * 成功した場合のみ`addBuffer`で出力zipへ追加する設計にした。これにより、1件のエントリの処理失敗が
 * 他のエントリ・年月全体の処理を巻き込んで止めることはない
 * @param sourceZipPath 処理対象の元アーカイブ（ディスク上のファイルパス）
 * @param destZipPath 生成するサムネイルzipの出力先パス
 * @returns 生成に成功したサムネイルエントリ・失敗したエントリの一覧
 */
export const generateThumbnailArchiveStreaming = async (
  sourceZipPath: string,
  destZipPath: string
): Promise<GenerateThumbnailArchiveResult> => {
  const outputZip = new yazl.ZipFile();
  const usedPaths = new Set<string>();
  const entries: ThumbnailArchiveEntry[] = [];
  const failedEntries: FailedThumbnailEntry[] = [];

  const writePromise = writeYazlOutput(outputZip, destZipPath);

  await forEachZipEntry(sourceZipPath, async (zipFile, entry) => {
    if (entry.fileName.endsWith('/')) {
      return;
    }

    try {
      const readStream = await openEntryReadStream(zipFile, entry);
      const originalBuffer = await readStreamToBuffer(readStream);
      // 元アーカイブは動画削除済みのはずだが、念のため動画エントリはサムネイル化の対象から除外する。
      // 拡張子だけでなく中身(ISOBMFFのftyp+メジャーブランド)も確認する。実データで、拡張子が
      // 失われた動画ファイル(iPhoneのLive Photoに付随するQuickTime動画等)が写真として誤処理され
      // サムネイル生成に失敗する事例が見つかったため
      if (isVideoFile(entry.fileName) || looksLikeVideoContainer(originalBuffer)) {
        return;
      }
      const thumbnailBuffer = await generateThumbnailBuffer(originalBuffer, entry.fileName);

      const archivePath = resolveUniquePath(basename(entry.fileName), usedPaths);
      outputZip.addBuffer(thumbnailBuffer, archivePath, { compress: false });
      usedPaths.add(archivePath);
      entries.push({ archivePath });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.error(`[thumbnail] ${entry.fileName}のサムネイル生成に失敗したためスキップします:`, error);
      failedEntries.push({ archivePath: entry.fileName, reason });
    }
  });

  outputZip.end();
  await writePromise;

  return { entries, failedEntries };
};
