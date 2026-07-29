/** consolidateArchiveFilesWithoutVideosStreamingの戻り値のうち、保持した写真1件分 */
export type ConsolidatedKeptEntry = {
  /** エントリの元となったGoogle DriveファイルID */
  sourceFileId: string;
  /** 統合前の元アーカイブ内でのエントリパス */
  oldArchivePath: string;
  /** 統合後の新規アーカイブ内でのエントリパス（同名衝突がある場合は連番が付く） */
  newArchivePath: string;
};

/** consolidateArchiveFilesWithoutVideosStreamingの戻り値のうち、動画として除外した1件分 */
export type RemovedVideoEntry = {
  /** エントリの元となったGoogle DriveファイルID */
  sourceFileId: string;
  /** 元アーカイブ内でのエントリパス */
  archivePath: string;
};
