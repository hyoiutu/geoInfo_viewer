import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export const SWAGGER_ROUTE = 'api';

const SWAGGER_TITLE = 'geoInfo_viewer API';
const SWAGGER_DESCRIPTION = '自転車ログ(Strava連携)等、geoInfo_viewerバックエンドが提供するAPIの仕様';
const SWAGGER_VERSION = '1.0';

/**
 * Swagger UI（OpenAPIドキュメント）をアプリへセットアップする。
 * 各APIのリクエスト/レスポンス形式は、コントローラー・DTOの型定義（TSDocコメント含む）から
 * `@nestjs/swagger`のコンパイラプラグイン（nest-cli.json参照）により自動的に抽出される
 * @param app セットアップ対象のNestJSアプリケーション
 */
export const setupSwagger = (app: INestApplication): void => {
  const config = new DocumentBuilder()
    .setTitle(SWAGGER_TITLE)
    .setDescription(SWAGGER_DESCRIPTION)
    .setVersion(SWAGGER_VERSION)
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(SWAGGER_ROUTE, app, document);
};
