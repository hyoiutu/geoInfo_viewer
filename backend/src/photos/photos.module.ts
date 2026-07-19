import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GoogleDriveModule } from '../google-drive/google-drive.module';
import { MonthlyPhotoArchiveEntity } from './entities/monthly-photo-archive.entity';
import { PhotoEntity } from './entities/photo.entity';
import { MonthlyPhotoArchiveService } from './monthly-photo-archive.service';
import { PhotoIngestService } from './photo-ingest.service';
import { PhotosController } from './photos.controller';

@Module({
  imports: [GoogleDriveModule, TypeOrmModule.forFeature([PhotoEntity, MonthlyPhotoArchiveEntity])],
  controllers: [PhotosController],
  providers: [PhotoIngestService, MonthlyPhotoArchiveService]
})
export class PhotosModule {}
