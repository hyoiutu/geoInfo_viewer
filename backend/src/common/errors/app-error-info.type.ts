import type { AppErrorCode } from './app-error-code.constants';

// バックエンドの全エンドポイントが共通で返すエラーレスポンス形式。
// errorCode: フロントエンドが種別ごとの分岐に使う識別子
// message: ユーザーに表示する日本語のエラー内容
// hint: ユーザーが取るべき対応（無い場合はnull）
export type AppErrorInfo = {
  errorCode: AppErrorCode;
  message: string;
  hint: string | null;
};
