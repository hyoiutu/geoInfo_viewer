import type { AppErrorInfo } from '../types/apiError';

const GENERIC_ERROR_MESSAGE_PREFIX = '通信に失敗しました';

export class ApiError extends Error {
  readonly errorCode: AppErrorInfo['errorCode'];
  readonly hint: string | null;

  constructor(errorInfo: AppErrorInfo) {
    super(errorInfo.message);
    this.name = 'ApiError';
    this.errorCode = errorInfo.errorCode;
    this.hint = errorInfo.hint;
  }
}

const isAppErrorInfo = (value: unknown): value is AppErrorInfo =>
  typeof value === 'object' && value !== null && 'errorCode' in value && 'message' in value && 'hint' in value;

// バックエンドのエラーレスポンス(AppErrorInfo形式)をパースしてApiErrorを組み立てる。
// バックエンド未起動時等、JSONボディが無い/形式が異なる場合はステータスコードのみの汎用エラーにフォールバックする。
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

// try/catchで受け取った不明なエラーを、エラーダイアログ表示用の共通形式に変換する。
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
