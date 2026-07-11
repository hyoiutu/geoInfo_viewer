import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { APP_ERROR_CODE } from './app-error-code.constants';
import type { AppErrorInfo } from './app-error-info.type';
import { isAppErrorInfo } from './app-error-info.util';

// expressのResponse型そのものへは依存せず、この実装が実際に使うメソッドのみを構造的に要求する
type MinimalHttpResponse = {
  status: (code: number) => { json: (body: unknown) => void };
};

/**
 * アプリ全体の例外を捕捉し、レスポンス形式をAppErrorInfo（errorCode/message/hint）に統一する。
 * AppExceptionはそのボディをそのまま使い、それ以外のHttpException・未知のエラーもこの形式に整形する。
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  /**
   * @param exception 捕捉した例外・エラー
   * @param host NestJSが渡す実行コンテキスト（レスポンスオブジェクトの取得に使う）
   */
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<MinimalHttpResponse>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();

      if (isAppErrorInfo(body)) {
        response.status(status).json(body);
        return;
      }

      const errorInfo: AppErrorInfo = {
        errorCode: APP_ERROR_CODE.internalError,
        message: typeof body === 'string' ? body : exception.message,
        hint: null
      };
      response.status(status).json(errorInfo);
      return;
    }

    const errorInfo: AppErrorInfo = {
      errorCode: APP_ERROR_CODE.internalError,
      message: '予期しないエラーが発生しました',
      hint: 'しばらく時間をおいて再度お試しください。解決しない場合は運営に問い合わせてください'
    };
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorInfo);
  }
}
