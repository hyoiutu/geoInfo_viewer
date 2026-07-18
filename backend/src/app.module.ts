import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivitiesModule } from './activities/activities.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { createDataSourceOptions } from './database/database.config';
import { GoogleDriveModule } from './google-drive/google-drive.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot(createDataSourceOptions(process.env)),
    ActivitiesModule,
    GoogleDriveModule
  ],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule {}
