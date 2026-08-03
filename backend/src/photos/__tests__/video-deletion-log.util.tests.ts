import { describe, expect, test } from 'vitest';
import { formatVideoDeletionLogLine } from '../video-deletion-log.util';

describe('formatVideoDeletionLogLineに関するテスト（Issue #104）', () => {
  test('撮影日時が取得できた場合、ファイル名とISO 8601形式の撮影日時をJSON行として整形する', () => {
    const line = formatVideoDeletionLogLine({
      fileName: 'VIDEO_1.mov',
      takenAt: new Date('2026-07-01T12:34:56.789Z')
    });

    expect(line).toBe('{"fileName":"VIDEO_1.mov","takenAt":"2026-07-01T12:34:56.789Z"}\n');
  });

  test('撮影日時が取得できなかった場合、takenAtをnullとして整形する', () => {
    const line = formatVideoDeletionLogLine({ fileName: 'VIDEO_2.mp4', takenAt: null });

    expect(line).toBe('{"fileName":"VIDEO_2.mp4","takenAt":null}\n');
  });
});
