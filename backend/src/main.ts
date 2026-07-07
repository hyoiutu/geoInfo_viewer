import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

const PORT = 3000;

const bootstrap = async () => {
  const app = await NestFactory.create(AppModule);
  await app.listen(PORT);
};

bootstrap();
