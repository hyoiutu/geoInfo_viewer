import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { StravaModule } from './strava/strava.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), StravaModule],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule {}
