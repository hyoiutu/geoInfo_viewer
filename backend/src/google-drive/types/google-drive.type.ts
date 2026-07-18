// biome-ignore-all lint/style/useNamingConvention: Google APIのレスポンス形式(snake_case)にそのまま合わせるための型定義

/** GET /drive/v3/files/{fileId}（メタデータ取得API）のレスポンス */
export type GoogleDriveFileMetadata = {
  /** DriveファイルID */
  id: string;
  /** ファイル名 */
  name: string;
  /** MIMEタイプ */
  mimeType: string;
  /** ファイルサイズ（バイト数、bigint相当の文字列。フォルダ等サイズを持たないファイルの場合はundefined） */
  size?: string;
};

/** POST /token（トークンリフレッシュAPI）のレスポンス */
export type GoogleTokenResponse = {
  /** 新しいアクセストークン */
  access_token: string;
  /** アクセストークンの有効期間（秒） */
  expires_in: number;
};
