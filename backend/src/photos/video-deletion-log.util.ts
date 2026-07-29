/** formatVideoDeletionLogLineの入力（削除した動画1件分の記録内容） */
export type DeletedVideoLogEntry = {
  /** 削除したファイルのファイル名 */
  fileName: string;
  /** EXIFから抽出した撮影日時。抽出できなかった場合はnull */
  takenAt: Date | null;
};

/**
 * 削除した動画1件分を、復旧時にGoogle Photos側で検索できるようファイル名・撮影日時（ISO 8601形式、
 * 取得できた場合はミリ秒単位）を記録するJSON Lines形式の1行に整形する。ローカルのTakeout展開データは
 * 保持しない運用のため、誤って写真を動画と判定し削除してしまった場合の復旧はこのログのみが手がかりになる
 * （Issue #104の検討事項「結論（2026-07-30）」参照）
 * @param entry 削除した動画1件分の記録内容
 * @returns 末尾に改行を含むJSON文字列（追記型ログファイルへそのまま書き込める）
 */
export const formatVideoDeletionLogLine = (entry: DeletedVideoLogEntry): string =>
  `${JSON.stringify({ fileName: entry.fileName, takenAt: entry.takenAt?.toISOString() ?? null })}\n`;
