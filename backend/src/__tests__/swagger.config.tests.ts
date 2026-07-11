import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { describe, expect, test, vi } from 'vitest';
import { SWAGGER_ROUTE, setupSwagger } from '../swagger.config';

vi.mock('@nestjs/swagger', async () => {
  const actual = await vi.importActual<typeof import('@nestjs/swagger')>('@nestjs/swagger');
  return {
    ...actual,
    // biome-ignore lint/style/useNamingConvention: モック対象の実際のexport名(SwaggerModule)に合わせる
    SwaggerModule: {
      createDocument: vi.fn().mockReturnValue({ openapi: '3.0.0' }),
      setup: vi.fn()
    }
  };
});

describe('setupSwaggerに関するテスト', () => {
  test('Swaggerドキュメントを組み立て、SWAGGER_ROUTEにセットアップする', () => {
    const app = {} as INestApplication;

    setupSwagger(app);

    expect(SwaggerModule.createDocument).toHaveBeenCalledWith(app, expect.any(Object));
    expect(SwaggerModule.setup).toHaveBeenCalledWith(SWAGGER_ROUTE, app, { openapi: '3.0.0' });
  });

  test('DocumentBuilderで組み立てた設定にタイトルが含まれる', () => {
    const app = {} as INestApplication;
    const setTitleSpy = vi.spyOn(DocumentBuilder.prototype, 'setTitle');

    setupSwagger(app);

    expect(setTitleSpy).toHaveBeenCalledWith('geoInfo_viewer API');
  });
});
