// E2Eテストではモックサーバーに向けるため環境変数で上書き可能にしている（通常は未設定でGoogle公式URLを使う）。
export const GOOGLE_DRIVE_API_BASE_URL = process.env.GOOGLE_DRIVE_API_BASE_URL ?? 'https://www.googleapis.com/drive/v3';
export const GOOGLE_OAUTH_TOKEN_URL = process.env.GOOGLE_OAUTH_TOKEN_URL ?? 'https://oauth2.googleapis.com/token';
export const GOOGLE_GRANT_TYPE_REFRESH_TOKEN = 'refresh_token';
export const GOOGLE_DRIVE_FILE_METADATA_FIELDS = 'id,name,mimeType,size';
export const TOKEN_EXPIRY_BUFFER_SECONDS = 300;

export const GOOGLE_DRIVE_ROUTE = 'google-drive';
export const GOOGLE_DRIVE_FILES_ROUTE = 'files/:fileId';
