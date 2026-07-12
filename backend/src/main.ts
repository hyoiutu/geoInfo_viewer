import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/errors/all-exceptions.filter';
import { setupSwagger } from './swagger.config';

const DEFAULT_PORT = 3000;
const PORT = Number(process.env.PORT) || DEFAULT_PORT;

/** NestJSアプリケーションを起動する */
const bootstrap = async () => {
  const app = await NestFactory.create(AppModule);
  // 開発時はElectronレンダラー(file://)・Viteのdevサーバー(http://localhost:5173)など
  // オリジンが変化しうるため、現時点では全オリジンを許可する（本番向けの絞り込みは別途検討する）
  app.enableCors();
  // 全エンドポイントのエラーレスポンス形式をAppErrorInfo（errorCode/message/hint）に統一する
  app.useGlobalFilters(new AllExceptionsFilter());
  setupSwagger(app);
  await app.listen(PORT);
};

bootstrap();
