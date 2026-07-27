// Android Motion Photo(`.mp`拡張子)の多くは、先頭にJPEG本体、その後ろにMP4の動画データが連結された
// ハイブリッド形式。動画データはISO Base Media File Format(ISOBMFF)のftypボックスから始まり、
// ftypボックスは「4バイトのボックスサイズ + 'ftyp'(4バイトのボックスタイプ) + ...」という構造を持つ。
// sharpはこの結合ファイル全体を画像として認識できずデコードに失敗するため、ftypボックスの開始位置を
// 手前のJPEG部分から切り離すことで、先頭のJPEG部分のみを抽出できる。
// ただし実データ実行の結果、一部の`.mp`ファイルはこの「JPEG先頭+動画後続」という構造を持たず、
// 動画コンテナ自体が本体でftypボックスがファイルの冒頭近くに現れる（＝手前にJPEG本体が入る余地が
// 無い）ケースが確認された。この場合はJPEG部分を抽出できないため、その旨のエラーを投げて呼び出し元
// （`generate-thumbnail-archive-streaming.util.ts`）に判断を委ねる
const MP4_FTYP_BOX_TYPE = Buffer.from('ftyp', 'ascii');
const BOX_SIZE_FIELD_LENGTH = 4;

/**
 * Android Motion Photo(JPEG本体の後ろにMP4動画データが連結されたハイブリッド形式)のバッファから、
 * 先頭のJPEG部分のみを抽出する
 * @param motionPhotoBuffer Motion Photoファイル全体のバッファ
 * @returns 抽出したJPEG部分のバッファ
 */
export const extractJpegFromMotionPhoto = (motionPhotoBuffer: Buffer): Buffer => {
  const ftypIndex = motionPhotoBuffer.indexOf(MP4_FTYP_BOX_TYPE);
  if (ftypIndex <= BOX_SIZE_FIELD_LENGTH) {
    throw new Error('Motion Photoファイルの先頭にJPEG本体が見つかりませんでした');
  }

  return motionPhotoBuffer.subarray(0, ftypIndex - BOX_SIZE_FIELD_LENGTH);
};
