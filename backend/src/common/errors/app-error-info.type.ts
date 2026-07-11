import type { AppErrorCode } from './app-error-code.constants';

/** バックエンドの全エンドポイントが共通で返すエラーレスポンス形式 */
export type AppErrorInfo = {
  /** フロントエンドが種別ごとの分岐に使う識別子 */
  errorCode: AppErrorCode;
  /** ユーザーに表示する日本語のエラー内容 */
  message: string;
  /** ユーザーが取るべき対応（無い場合はnull） */
  hint: string | null;
};
