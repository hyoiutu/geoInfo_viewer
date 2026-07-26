// Android Motion Photo(`.mp`拡張子)は、先頭にJPEG本体、その後ろにMP4の動画データが連結された
// ハイブリッド形式。動画データはISO Base Media File Format(ISOBMFF)のftypボックスから始まり、
// ftypボックスは「4バイトのボックスサイズ + 'ftyp'(4バイトのボックスタイプ) + ...」という構造を持つ。
// sharpはこの結合ファイル全体を画像として認識できずデコードに失敗するため、ftypボックスの開始位置を
// 手前のJPEG部分から切り離すことで、先頭のJPEG部分のみを抽出できる
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
  if (ftypIndex < BOX_SIZE_FIELD_LENGTH) {
    throw new Error('Motion PhotoファイルからMP4のftypボックスが見つかりませんでした');
  }

  return motionPhotoBuffer.subarray(0, ftypIndex - BOX_SIZE_FIELD_LENGTH);
};
