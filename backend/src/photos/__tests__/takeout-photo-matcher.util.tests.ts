import { describe, expect, test } from 'vitest';
import type { TakeoutArchiveEntry } from '../takeout-archive.util';
import { matchPhotosWithJsonSidecars } from '../takeout-photo-matcher.util';

const createEntry = (path: string): TakeoutArchiveEntry => ({ path, data: Buffer.from(path) });

describe('matchPhotosWithJsonSidecarsに関するテスト', () => {
  test('{写真名}.jsonの完全一致がある場合、そのJSONとマッチする', () => {
    const photo = createEntry('album/IMG_1234.jpg');
    const json = createEntry('album/IMG_1234.jpg.json');

    const result = matchPhotosWithJsonSidecars([photo], [json]);

    expect(result).toEqual([{ photo, json }]);
  });

  test('{写真名}.supplemental-metadata.jsonの完全一致がある場合、そのJSONとマッチする', () => {
    const photo = createEntry('album/IMG_1234.jpg');
    const json = createEntry('album/IMG_1234.jpg.supplemental-metadata.json');

    const result = matchPhotosWithJsonSidecars([photo], [json]);

    expect(result).toEqual([{ photo, json }]);
  });

  test('拡張子を除いた完全一致(IMG_1234.jsonのように写真の拡張子が無いJSON)の場合、そのJSONとマッチする', () => {
    const photo = createEntry('album/IMG_1234.jpg');
    const json = createEntry('album/IMG_1234.json');

    const result = matchPhotosWithJsonSidecars([photo], [json]);

    expect(result).toEqual([{ photo, json }]);
  });

  test('JSON側の接尾辞(.supplemental-metadata)が46文字制限で不規則に切り詰められている場合でも、写真名を前方一致で含むJSONとマッチする', () => {
    const photo = createEntry('album/a-very-long-photo-filename-example.jpg');
    const json = createEntry('album/a-very-long-photo-filename-example.jpg.supple.json');

    const result = matchPhotosWithJsonSidecars([photo], [json]);

    expect(result).toEqual([{ photo, json }]);
  });

  test('複数のJSON候補がプレフィックス一致する場合、最も長く一致するものを選ぶ', () => {
    const photo = createEntry('album/IMG_1234.jpg');
    const shortMatch = createEntry('album/IMG_123.json');
    const longMatch = createEntry('album/IMG_1234.json');

    const result = matchPhotosWithJsonSidecars([photo], [shortMatch, longMatch]);

    expect(result).toEqual([{ photo, json: longMatch }]);
  });

  test('対応するJSONが見つからない場合、jsonはnullになる', () => {
    const photo = createEntry('album/IMG_9999.jpg');
    const unrelatedJson = createEntry('album/IMG_0000.jpg.json');

    const result = matchPhotosWithJsonSidecars([photo], [unrelatedJson]);

    expect(result).toEqual([{ photo, json: null }]);
  });

  test('複数の写真をそれぞれ対応するJSONとマッチさせる', () => {
    const photo1 = createEntry('album/IMG_1.jpg');
    const json1 = createEntry('album/IMG_1.jpg.json');
    const photo2 = createEntry('album/IMG_2.jpg');
    const json2 = createEntry('album/IMG_2.jpg.json');

    const result = matchPhotosWithJsonSidecars([photo1, photo2], [json1, json2]);

    expect(result).toEqual([
      { photo: photo1, json: json1 },
      { photo: photo2, json: json2 }
    ]);
  });
});
