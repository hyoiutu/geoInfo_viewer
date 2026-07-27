import { extname } from 'node:path';

// '.mp'はAndroid Motion Photoの拡張子。実データ調査の結果、データセット中の全11件が
// 「動画本体のみで静止画は同じアーカイブ内の別ファイル（`<ファイル名>.mp.jpg`）として存在する」
// 構成であり、`.mp`ファイル自体から静止画を抽出できた実例は確認されなかった（Issue #100）。
// そのため`.mp`は動画として扱い、対応する`.jpg`側は別エントリとして通常通り処理される
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.avi', '.mkv', '.3gp', '.webm', '.m4v', '.mp']);

/**
 * ファイル名の拡張子から、動画ファイルかどうかを判定する
 * @param fileName 対象ファイルのファイル名
 * @returns 動画ファイルの場合true
 */
export const isVideoFile = (fileName: string): boolean => VIDEO_EXTENSIONS.has(extname(fileName).toLowerCase());

// 実際のISOBMFFファイルは、先頭4バイトがボックスサイズ、続く4バイトが'ftyp'、
// さらに続く4バイトがメジャーブランド（コンテナの種類を表す識別子）という構造を持つ
const ISOBMFF_BOX_TYPE_OFFSET = 4;
const ISOBMFF_MAJOR_BRAND_OFFSET = 8;
const ISOBMFF_FIELD_LENGTH = 4;
const FTYP_BOX_TYPE = 'ftyp';

// HEIC/HEIF（静止画）として使われることが確認されているメジャーブランド。実データ実行の結果、
// 拡張子が失われた動画（iPhoneのLive Photoに付随するQuickTime動画等）がこのメジャーブランドの
// 一覧に含まれないftypコンテナとして見つかったため、この一覧に含まれないftypコンテナは
// 動画（QuickTime/MP4等）とみなす。本プロジェクトが実際に扱う画像形式はJPEG/PNG/HEIC/HEIFのみで
// あり、それ以外のftypコンテナ形式の静止画は想定していないため、この判定方針で十分と判断した
const HEIC_MAJOR_BRANDS = new Set(['heic', 'heix', 'heim', 'heis', 'hevc', 'hevx', 'hevm', 'hevs', 'mif1', 'msf1']);

/**
 * バッファの先頭バイトから、ISOBMFF（HEIC/HEIF・QuickTime/MP4等が準拠するコンテナ形式）の
 * ftypボックスかつHEIC/HEIF以外のメジャーブランドを持つ、すなわち動画コンテナであるかどうかを
 * 判定する。拡張子が失われた動画ファイル（`isVideoFile`では検出できない）を検出するために使う
 * @param buffer 判定対象のバッファ
 * @returns 動画コンテナとみなせる場合true
 */
export const looksLikeVideoContainer = (buffer: Buffer): boolean => {
  const majorBrandEnd = ISOBMFF_MAJOR_BRAND_OFFSET + ISOBMFF_FIELD_LENGTH;
  if (buffer.length < majorBrandEnd) {
    return false;
  }
  const boxType = buffer
    .subarray(ISOBMFF_BOX_TYPE_OFFSET, ISOBMFF_BOX_TYPE_OFFSET + ISOBMFF_FIELD_LENGTH)
    .toString('ascii');
  if (boxType !== FTYP_BOX_TYPE) {
    return false;
  }
  const majorBrand = buffer.subarray(ISOBMFF_MAJOR_BRAND_OFFSET, majorBrandEnd).toString('ascii');
  return !HEIC_MAJOR_BRANDS.has(majorBrand);
};
