import { createHash } from 'node:crypto';
import { copyFileSync, createReadStream, mkdirSync, readdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { resolveUniquePath } from './monthly-archive.util';

/** flattenPhotoDirectoryの戻り値 */
export type FlattenPhotoDirectoryResult = {
  /** 出力先ディレクトリへコピーした件数 */
  copiedCount: number;
  /** 内容が完全に一致する重複としてコピーをスキップした件数 */
  skippedDuplicateCount: number;
};

/**
 * 指定したディレクトリ以下を再帰的に走査し、ファイル（ディレクトリを除く）の絶対パス一覧を返す。
 * 走査順序を実行のたびに安定させるため、パスの昇順にソートして返す
 * @param directoryPath 走査対象のディレクトリパス
 * @returns ファイルの絶対パス一覧（パス昇順）
 */
const scanFilesRecursively = (directoryPath: string): string[] => {
  const files: string[] = [];
  for (const entryName of readdirSync(directoryPath)) {
    const entryPath = join(directoryPath, entryName);
    if (statSync(entryPath).isDirectory()) {
      files.push(...scanFilesRecursively(entryPath));
    } else {
      files.push(entryPath);
    }
  }
  return files.sort();
};

/**
 * ファイルの内容からSHA-256ハッシュを求める。動画等の大きいファイルでもメモリへ全体を
 * 読み込まずに済むよう、ストリームで読み進めながら計算する
 * @param filePath 対象ファイルのパス
 * @returns 16進数文字列のハッシュ値
 */
const computeFileHash = (filePath: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    createReadStream(filePath)
      .on('data', (chunk) => hash.update(chunk))
      .on('end', () => resolve(hash.digest('hex')))
      .on('error', reject);
  });

/**
 * Google Takeoutの展開データのように深くネストしたディレクトリ構造の写真・JSONサイドカーを、
 * サブディレクトリなしのフラットな1ディレクトリへコピーする（写真ローカルバックフィルスクリプト
 * `backfill-photos-from-local.ts`の入力形式に合わせるため。Issue #23）。
 * Google Takeoutは同じ写真が複数のアルバムフォルダに重複して含まれることがあるため、
 * ファイル名が衝突した際は内容のSHA-256ハッシュを比較し、内容が完全に一致する場合はコピーを
 * スキップ（1件に集約）、内容が異なる場合は拡張子の直前へ連番を付けて別ファイルとして保存する
 * （`resolveUniquePath`、`mergeMonthlyArchive`と共通のロジック）。元のディレクトリ構造・ファイルは
 * 変更しない（コピーのみ）
 * @param inputDirectoryPath 走査対象の展開済みディレクトリパス
 * @param outputDirectoryPath コピー先のフラットなディレクトリパス（存在しない場合は作成する）
 * @returns コピー件数・重複スキップ件数
 */
export const flattenPhotoDirectory = async (
  inputDirectoryPath: string,
  outputDirectoryPath: string
): Promise<FlattenPhotoDirectoryResult> => {
  mkdirSync(outputDirectoryPath, { recursive: true });

  const usedNames = new Set<string>();
  // 元のファイル名ごとに、出力先へ実際に配置した名前と、そのファイルのハッシュを記録する。
  // 同名の新しいファイルが来た際、いずれかのハッシュと一致すれば重複と判定してコピーをスキップする
  const placedHashesByOriginalName = new Map<string, Map<string, string>>();

  let copiedCount = 0;
  let skippedDuplicateCount = 0;

  for (const filePath of scanFilesRecursively(inputDirectoryPath)) {
    const originalName = basename(filePath);
    const hash = await computeFileHash(filePath);

    const placedVariants = placedHashesByOriginalName.get(originalName);
    const isDuplicate = placedVariants !== undefined && [...placedVariants.values()].includes(hash);
    if (isDuplicate) {
      skippedDuplicateCount += 1;
      continue;
    }

    const destinationName = resolveUniquePath(originalName, usedNames);
    copyFileSync(filePath, join(outputDirectoryPath, destinationName));
    usedNames.add(destinationName);
    if (placedVariants === undefined) {
      placedHashesByOriginalName.set(originalName, new Map([[destinationName, hash]]));
    } else {
      placedVariants.set(destinationName, hash);
    }
    copiedCount += 1;
  }

  return { copiedCount, skippedDuplicateCount };
};

// `pnpm --filter <package> run <script> -- <args>`はnpm scriptsと異なり、区切りの`--`自体を
// 除去せずそのままprocess.argvへ渡すため、位置引数を取り出す前に取り除いておく
const scriptArgs = process.argv.slice(2).filter((arg) => arg !== '--');
const [inputDirectoryPath, outputDirectoryPath] = scriptArgs;
if (inputDirectoryPath === undefined || outputDirectoryPath === undefined) {
  console.error(
    '使い方: ts-node src/photos/flatten-local-photo-directory.ts <展開済みディレクトリ> <出力先フラットディレクトリ>'
  );
  process.exitCode = 1;
} else {
  flattenPhotoDirectory(inputDirectoryPath, outputDirectoryPath)
    .then((result) => {
      console.log(`完了しました（コピー: ${result.copiedCount}件、重複スキップ: ${result.skippedDuplicateCount}件）`);
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
}
