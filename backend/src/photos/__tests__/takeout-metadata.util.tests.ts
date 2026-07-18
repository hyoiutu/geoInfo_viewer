// biome-ignore-all lint/style/useNamingConvention: exifrのタグ名(DateTimeOriginal等、PascalCase)に合わせたテストダブル
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { extractMetadataFromExif, extractMetadataFromJson } from '../takeout-metadata.util';

vi.mock('exifr', () => ({
  parse: vi.fn(),
  gps: vi.fn()
}));

describe('extractMetadataFromJsonに関するテスト', () => {
  test('photoTakenTime.timestampとgeoDataがある場合、takenAtとlocationを抽出する', () => {
    const json = Buffer.from(
      JSON.stringify({
        photoTakenTime: { timestamp: '1751328000' },
        geoData: { latitude: 35.6812, longitude: 139.7671 }
      })
    );

    const result = extractMetadataFromJson(json);

    expect(result).toEqual({
      takenAt: new Date(1751328000 * 1000),
      location: { type: 'Point', coordinates: [139.7671, 35.6812] }
    });
  });

  test('geoDataのlatitude/longitudeが両方0の場合、locationはnullになる', () => {
    const json = Buffer.from(
      JSON.stringify({
        photoTakenTime: { timestamp: '1751328000' },
        geoData: { latitude: 0, longitude: 0 }
      })
    );

    const result = extractMetadataFromJson(json);

    expect(result?.location).toBeNull();
  });

  test('geoDataが無くgeoDataExifがある場合、geoDataExifから位置情報を抽出する', () => {
    const json = Buffer.from(
      JSON.stringify({
        photoTakenTime: { timestamp: '1751328000' },
        geoDataExif: { latitude: 35.6812, longitude: 139.7671 }
      })
    );

    const result = extractMetadataFromJson(json);

    expect(result?.location).toEqual({ type: 'Point', coordinates: [139.7671, 35.6812] });
  });

  test('geoData・geoDataExifのどちらも無い場合、locationはnullになる', () => {
    const json = Buffer.from(JSON.stringify({ photoTakenTime: { timestamp: '1751328000' } }));

    const result = extractMetadataFromJson(json);

    expect(result).toEqual({ takenAt: new Date(1751328000 * 1000), location: null });
  });

  test('photoTakenTimeが無い場合、nullを返す', () => {
    const json = Buffer.from(JSON.stringify({ geoData: { latitude: 35.6812, longitude: 139.7671 } }));

    const result = extractMetadataFromJson(json);

    expect(result).toBeNull();
  });

  test('不正なJSON(パース失敗)の場合、nullを返す', () => {
    const json = Buffer.from('not a json');

    const result = extractMetadataFromJson(json);

    expect(result).toBeNull();
  });
});

describe('extractMetadataFromExifに関するテスト', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('DateTimeOriginalとGPS情報がある場合、takenAtとlocationを抽出する', async () => {
    const { parse, gps } = await import('exifr');
    vi.mocked(parse).mockResolvedValue({ DateTimeOriginal: new Date('2026-07-01T10:00:00.000Z') });
    vi.mocked(gps).mockResolvedValue({ latitude: 35.6812, longitude: 139.7671 });

    const result = await extractMetadataFromExif(Buffer.from('jpeg-binary'));

    expect(result).toEqual({
      takenAt: new Date('2026-07-01T10:00:00.000Z'),
      location: { type: 'Point', coordinates: [139.7671, 35.6812] }
    });
  });

  test('DateTimeOriginalが無い場合、nullを返す', async () => {
    const { parse } = await import('exifr');
    vi.mocked(parse).mockResolvedValue({});

    const result = await extractMetadataFromExif(Buffer.from('jpeg-binary'));

    expect(result).toBeNull();
  });

  test('GPS情報が取得できない場合、locationはnullになる', async () => {
    const { parse, gps } = await import('exifr');
    vi.mocked(parse).mockResolvedValue({ DateTimeOriginal: new Date('2026-07-01T10:00:00.000Z') });
    vi.mocked(gps).mockRejectedValue(new Error('no gps data found'));

    const result = await extractMetadataFromExif(Buffer.from('jpeg-binary'));

    expect(result).toEqual({ takenAt: new Date('2026-07-01T10:00:00.000Z'), location: null });
  });

  test('EXIF解析自体が例外を投げる場合(動画ファイル等、対応していない形式)、nullを返す', async () => {
    const { parse } = await import('exifr');
    vi.mocked(parse).mockRejectedValue(new Error('unsupported file format'));

    const result = await extractMetadataFromExif(Buffer.from('mp4-binary'));

    expect(result).toBeNull();
  });
});
