import { HttpException, type HttpStatus } from '@nestjs/common';
import type { AppErrorCode } from './app-error-code.constants';
import type { AppErrorInfo } from './app-error-info.type';

/**
 * アプリケーション内で意図的に投げる例外の基底クラス。
 * HttpExceptionのレスポンスボディを常にAppErrorInfo形式に統一する。
 */
export class AppException extends HttpException {
  /**
   * @param errorCode エラー種別を表す識別子
   * @param message ユーザーに表示する日本語のエラー内容
   * @param hint ユーザーが取るべき対応（無い場合はnull）
   * @param statusCode レスポンスとして返すHTTPステータスコード
   */
  constructor(errorCode: AppErrorCode, message: string, hint: string | null, statusCode: HttpStatus) {
    const body: AppErrorInfo = { errorCode, message, hint };
    super(body, statusCode);
  }
}
