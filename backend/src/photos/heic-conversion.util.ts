import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';

// sharpが内蔵するHEIC/HEIFデコーダ(libheif)はセキュリティ上限に抵触して正当な写真のデコードに
// 失敗することがあるため、この拡張子は本ファイルのheif-convert CLI経由で変換する
const HEIC_EXTENSIONS = new Set(['.heic', '.heif']);

// 実際のHEIC/HEIFファイルはISOBMFFコンテナで、先頭4バイトがボックスサイズ、続く4バイトが
// 'ftyp'という構造を持つ。実データ実行の結果、拡張子が.heic/.heifでも中身が実際には別形式
// （編集アプリでの再保存等によりJPEGへ変わっている等）のファイルが多数存在し、heif-convertが
// 「Input file does not appear to start with a valid box length. Possibly could be a JPEG file
// instead.」というエラーで変換に失敗することが判明した。拡張子だけでなく中身の先頭バイトも
// 確認し、実際にHEIC/HEIFコンテナである場合のみheif-convertへ回す（Issue #100）
const ISOBMFF_BOX_TYPE_OFFSET = 4;
const ISOBMFF_FTYP_BOX_TYPE = 'ftyp';

/**
 * バッファの先頭バイトが、実際にISOBMFF（HEIC/HEIFが準拠するコンテナ形式）のftypボックスから
 * 始まっているかどうかを判定する
 * @param buffer 判定対象のバッファ
 * @returns ISOBMFFのftypボックスから始まっている場合true
 */
const looksLikeHeicContainer = (buffer: Buffer): boolean => {
  const ftypBoxEnd = ISOBMFF_BOX_TYPE_OFFSET + ISOBMFF_FTYP_BOX_TYPE.length;
  return (
    buffer.length >= ftypBoxEnd &&
    buffer.subarray(ISOBMFF_BOX_TYPE_OFFSET, ftypBoxEnd).toString('ascii') === ISOBMFF_FTYP_BOX_TYPE
  );
};

/**
 * ファイル名の拡張子が.heic/.heifで、かつ中身も実際にISOBMFFのftypボックスから始まっている
 * （＝拡張子だけでなく内容としても実際にHEIC/HEIFである）かどうかを判定する。
 * サムネイル生成（`thumbnail-generation.util.ts`、Issue #100）・元サイズ写真の事前一括変換
 * （`convert-heic-archive-entries.util.ts`、Issue #106）の両方から使う共通の判定処理
 * @param fileName 判定対象のファイル名（拡張子判定に使用）
 * @param buffer 判定対象のバッファ（中身の先頭バイト確認に使用）
 * @returns 拡張子・中身の両方が実際にHEIC/HEIFである場合true
 */
export const isActualHeicFile = (fileName: string, buffer: Buffer): boolean =>
  HEIC_EXTENSIONS.has(extname(fileName).toLowerCase()) && looksLikeHeicContainer(buffer);

const HEIF_CONVERT_COMMAND = 'heif-convert';
// sharpが内蔵するlibheifデコーダは、悪意あるファイルからのDoS対策としてセキュリティ上限
// (iref boxの参照数16件超等)を持つが、iPhoneのポートレート/Live Photoが持つ補助画像(深度マップ等)を
// 含む正当なHEICファイルもこの上限に抵触してデコードに失敗することがある。sharp自体はこの上限を
// 緩和するオプションを公開していないため、libheif付属のCLIツールheif-convertを別プロセスとして
// 呼び出し、--disable-limitsで上限を無効化した上でJPEGへ変換する。自分自身が撮影した信頼できる
// 写真のみを処理する本バッチでは、上限を無効化しても安全と判断した
const DISABLE_LIMITS_OPTION = '--disable-limits';
const HELP_OPTION = '--help';

/** execFileSyncが投げるエラーのうち、コマンド未検出時に付与される`code`プロパティを持つ形状 */
type ExecFileSyncError = Error & {
  /** Node.jsのエラーコード。コマンドが見つからない場合は'ENOENT' */
  code?: string;
  /** コマンドが実行はされたが異常終了した場合、その標準出力（heif-convertは--help指定時もexit code 1で終了するため、この標準出力の中身で判定する） */
  stdout?: Buffer;
};

/**
 * catchした値が、execFileSyncが投げるエラー（`code`/`stdout`プロパティを持ちうるErrorインスタンス）
 * であるかを判定する型ガード
 * @param error catchした値
 * @returns ExecFileSyncErrorとして扱える場合true
 */
const isExecFileSyncError = (error: unknown): error is ExecFileSyncError => error instanceof Error;

/**
 * heif-convertが実行可能で、`--disable-limits`オプションに対応しているかを確認する。
 * 対応していない場合（コマンドが見つからない、古いバージョンで未対応等）はエラーを投げる。
 * サムネイル生成バッチはこの確認を経ずに実行してはならない。heif-convertが使えない環境で
 * `convertHeicBufferToJpegBuffer`を呼び出すと、本来sharp単体で成功していたはずのHEIC写真まで
 * 含めて全滅し、既存の（より良い）結果を静かに上書きしてしまう恐れがあるため
 * （実際に発生した事故: ユーザーの環境でheif-convertが見つからないままバッチが「正常終了」し、
 * 既に救済済みだった年月のサムネイルが劣化した状態で上書きされた）
 */
export const assertHeifConvertAvailable = (): void => {
  try {
    execFileSync(HEIF_CONVERT_COMMAND, [HELP_OPTION]);
    return;
  } catch (error) {
    if (!isExecFileSyncError(error)) {
      throw new Error(`heif-convertの実行確認に失敗しました: ${String(error)}`);
    }
    if (error.code === 'ENOENT') {
      throw new Error(
        'heif-convertコマンドが見つかりません。HEIC写真のサムネイル生成にはlibheif付属のheif-convertが必要です（例: brew install libheif）。'
      );
    }
    // heif-convertは--help指定時もexit code 1で終了するため、ここに到達すること自体は正常。
    // 標準出力の中身で--disable-limitsオプションへの対応有無を判定する
    const helpOutput = error.stdout?.toString() ?? '';
    if (!helpOutput.includes(DISABLE_LIMITS_OPTION)) {
      throw new Error(
        'heif-convertが--disable-limitsオプションに対応していません。libheifのバージョンが古い可能性があります（例: brew upgrade libheif）。'
      );
    }
  }
};

/**
 * heif-convert(libheif付属CLI、--disable-limitsでセキュリティ上限を無効化)を外部プロセスとして
 * 呼び出し、HEIC/HEIF画像のバッファをJPEG画像のバッファへ変換する
 * @param heicBuffer 変換元のHEIC/HEIF画像データ
 * @returns 変換後のJPEG画像データ
 */
export const convertHeicBufferToJpegBuffer = (heicBuffer: Buffer): Buffer => {
  const workDir = mkdtempSync(join(tmpdir(), 'heic-convert-'));
  try {
    const inputPath = join(workDir, 'input.heic');
    const outputPath = join(workDir, 'output.jpg');
    writeFileSync(inputPath, heicBuffer);
    execFileSync(HEIF_CONVERT_COMMAND, [DISABLE_LIMITS_OPTION, inputPath, outputPath]);
    return readFileSync(outputPath);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
};
