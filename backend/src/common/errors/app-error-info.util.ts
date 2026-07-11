import { AppException } from './app.exception';
import { APP_ERROR_CODE } from './app-error-code.constants';
import type { AppErrorInfo } from './app-error-info.type';

/**
 * 値がAppErrorInfo形式（errorCode/message/hintを持つオブジェクト）かどうかを判定する
 * @param value 判定対象の値
 * @returns AppErrorInfo形式であればtrue
 */
export const isAppErrorInfo = (value: unknown): value is AppErrorInfo =>
  typeof value === 'object' && value !== null && 'errorCode' in value && 'message' in value && 'hint' in value;

/**
 * try/catchで受け取った不明なエラーを、フロントエンドへ返す共通形式に変換する。
 * AppException（およびそのサブクラス）が持つ情報はそのまま使い、それ以外の予期しないエラーは
 * INTERNAL_ERRORとして扱う（詳細メッセージはError#messageがあればそれを使う）。
 * @param error try/catchで捕捉した不明な値
 * @returns フロントエンドへ返すAppErrorInfo
 */
export const toAppErrorInfo = (error: unknown): AppErrorInfo => {
  if (error instanceof AppException) {
    const body = error.getResponse();
    if (isAppErrorInfo(body)) {
      return body;
    }
  }

  return {
    errorCode: APP_ERROR_CODE.internalError,
    message: error instanceof Error ? error.message : '予期しないエラーが発生しました',
    hint: null
  };
};
