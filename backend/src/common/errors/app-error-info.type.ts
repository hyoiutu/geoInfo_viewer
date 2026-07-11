import { ApiProperty } from '@nestjs/swagger';
import type { AppErrorCode } from './app-error-code.constants';

// Swaggerのスキーマ自動抽出(@ApiProperty)がプロパティ単位のメタデータを付与できるよう、
// 本プロジェクトの「型定義にはtypeを使う」規約の例外としてclassを使う
// （rules.mdの「オブジェクト型の場合は名前付きtypeとして抽出する」の精神は保ったまま、
// classでも各プロパティにTSDocを付与している）。

/** バックエンドの全エンドポイントが共通で返すエラーレスポンス形式 */
export class AppErrorInfo {
  /** フロントエンドが種別ごとの分岐に使う識別子 */
  @ApiProperty({ description: 'フロントエンドが種別ごとの分岐に使う識別子' })
  errorCode!: AppErrorCode;

  /** ユーザーに表示する日本語のエラー内容 */
  @ApiProperty({ description: 'ユーザーに表示する日本語のエラー内容' })
  message!: string;

  /** ユーザーが取るべき対応（無い場合はnull） */
  @ApiProperty({ description: 'ユーザーが取るべき対応（無い場合はnull）', nullable: true, type: String })
  hint!: string | null;
}
