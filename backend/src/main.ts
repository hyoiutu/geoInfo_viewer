import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/errors/all-exceptions.filter';

const PORT = 3000;

const bootstrap = async () => {
  const app = await NestFactory.create(AppModule);
  // 開発時はElectronレンダラー(file://)・Viteのdevサーバー(http://localhost:5173)など
  // オリジンが変化しうるため、現時点では全オリジンを許可する（本番向けの絞り込みは別途検討する）
  app.enableCors();
  // 全エンドポイントのエラーレスポンス形式をAppErrorInfo（errorCode/message/hint）に統一する
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(PORT);
};

bootstrap();
