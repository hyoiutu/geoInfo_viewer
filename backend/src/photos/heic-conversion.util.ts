import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const HEIF_CONVERT_COMMAND = 'heif-convert';
// sharpが内蔵するlibheifデコーダは、悪意あるファイルからのDoS対策としてセキュリティ上限
// (iref boxの参照数16件超等)を持つが、iPhoneのポートレート/Live Photoが持つ補助画像(深度マップ等)を
// 含む正当なHEICファイルもこの上限に抵触してデコードに失敗することがある。sharp自体はこの上限を
// 緩和するオプションを公開していないため、libheif付属のCLIツールheif-convertを別プロセスとして
// 呼び出し、--disable-limitsで上限を無効化した上でJPEGへ変換する。自分自身が撮影した信頼できる
// 写真のみを処理する本バッチでは、上限を無効化しても安全と判断した
const DISABLE_LIMITS_OPTION = '--disable-limits';

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
