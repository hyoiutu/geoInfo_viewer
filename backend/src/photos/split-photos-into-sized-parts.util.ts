/**
 * 写真一覧を、累積サイズが上限を超えないように複数の配列（part）へ分割する。
 * 1つの年月の写真をまとめて1つのzipに構成しようとすると、動画を多く含む月ではGB規模になり、
 * プロセスが保持しなければならないメモリ量（元データ＋zip化後のバッファ）が実行環境の物理メモリを
 * 超えてプロセスが強制終了される不具合が写真ローカルバックフィルの実行時に実際に発生した（Issue #23）。
 * 対策として、1つの年月をサイズ上限ごとの複数partへ分割し、それぞれ独立したzipとして
 * 処理できるようにする（`backfill-photos-from-local.ts`・`MonthlyPhotoArchiveService`参照）
 * @param photos 分割対象の写真一覧（順序を保って処理する）
 * @param sizeOfBytes 1件あたりのバイト数を求める関数
 * @param maxBytesPerPart 1part あたりの上限バイト数
 * @returns サイズ上限ごとに分割された写真一覧の配列。1件だけで上限を超える写真は、それ単独で1つのpartになる
 */
export const splitPhotosIntoSizedParts = <T>(
  photos: T[],
  sizeOfBytes: (photo: T) => number,
  maxBytesPerPart: number
): T[][] => {
  const parts: T[][] = [];
  let currentPart: T[] = [];
  let currentBytes = 0;

  for (const photo of photos) {
    const size = sizeOfBytes(photo);
    if (currentPart.length > 0 && currentBytes + size > maxBytesPerPart) {
      parts.push(currentPart);
      currentPart = [];
      currentBytes = 0;
    }
    currentPart.push(photo);
    currentBytes += size;
  }

  if (currentPart.length > 0) {
    parts.push(currentPart);
  }

  return parts;
};
