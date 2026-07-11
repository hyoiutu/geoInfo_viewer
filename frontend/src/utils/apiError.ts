import type { AppErrorInfo } from '../types/apiError';

const GENERIC_ERROR_MESSAGE_PREFIX = '通信に失敗しました';

/** バックエンドのエラーレスポンス(AppErrorInfo)をラップする、errorCode/hintを保持するErrorのサブクラス */
export class ApiError extends Error {
  readonly errorCode: AppErrorInfo['errorCode'];
  readonly hint: string | null;

  /** @param errorInfo バックエンドから受け取ったエラー情報 */
  constructor(errorInfo: AppErrorInfo) {
    super(errorInfo.message);
    this.name = 'ApiError';
    this.errorCode = errorInfo.errorCode;
    this.hint = errorInfo.hint;
  }
}

/**
 * 値がAppErrorInfo形式（errorCode/message/hintを持つオブジェクト）かどうかを判定する
 * @param value 判定対象の値
 * @returns AppErrorInfo形式であればtrue
 */
const isAppErrorInfo = (value: unknown): value is AppErrorInfo =>
  typeof value === 'object' && value !== null && 'errorCode' in value && 'message' in value && 'hint' in value;

/**
 * バックエンドのエラーレスポンス(AppErrorInfo形式)をパースしてApiErrorを組み立てる。
 * バックエンド未起動時等、JSONボディが無い/形式が異なる場合はステータスコードのみの汎用エラーにフォールバックする。
 * @param response `response.ok`がfalseだったfetchのレスポンス
 * @returns 組み立てたApiError
 */
export const buildApiError = async (response: Response): Promise<ApiError> => {
  const body: unknown = await response.json().catch(() => null);
  if (isAppErrorInfo(body)) {
    return new ApiError(body);
  }

  return new ApiError({
    errorCode: 'INTERNAL_ERROR',
    message: `${GENERIC_ERROR_MESSAGE_PREFIX} (status: ${response.status})`,
    hint: null
  });
};

/**
 * try/catchで受け取った不明なエラーを、エラーダイアログ表示用の共通形式に変換する。
 * @param error try/catchで捕捉した不明な値
 * @returns エラーダイアログ表示用のAppErrorInfo
 */
export const toAppErrorInfo = (error: unknown): AppErrorInfo => {
  if (error instanceof ApiError) {
    return { errorCode: error.errorCode, message: error.message, hint: error.hint };
  }

  return {
    errorCode: 'INTERNAL_ERROR',
    message: error instanceof Error ? error.message : '予期しないエラーが発生しました',
    hint: null
  };
};
