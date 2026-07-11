import { ApiProperty } from '@nestjs/swagger';
import { APP_ERROR_CODE, type AppErrorCode } from './app-error-code.constants';

/** バックエンドの全エンドポイントが共通で返すエラーレスポンス形式 */
export class AppErrorInfo {
  /** フロントエンドが種別ごとの分岐に使う識別子 */
  @ApiProperty({
    description: 'フロントエンドが種別ごとの分岐に使う識別子',
    enum: Object.values(APP_ERROR_CODE)
  })
  errorCode!: AppErrorCode;

  /** ユーザーに表示する日本語のエラー内容 */
  @ApiProperty({ description: 'ユーザーに表示する日本語のエラー内容' })
  message!: string;

  /** ユーザーが取るべき対応（無い場合はnull） */
  @ApiProperty({ description: 'ユーザーが取るべき対応（無い場合はnull）', nullable: true, type: String })
  hint!: string | null;
}
