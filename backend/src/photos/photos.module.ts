import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CyclingActivityEntity } from '../activities/entities/cycling-activity.entity';
import { GoogleDriveModule } from '../google-drive/google-drive.module';
import { MonthlyPhotoArchiveEntity } from './entities/monthly-photo-archive.entity';
import { MonthlyPhotoThumbnailArchiveEntity } from './entities/monthly-photo-thumbnail-archive.entity';
import { PhotoEntity } from './entities/photo.entity';
import { MonthlyPhotoArchiveService } from './monthly-photo-archive.service';
import { MonthlyPhotoThumbnailArchiveService } from './monthly-photo-thumbnail-archive.service';
import { PhotoIngestService } from './photo-ingest.service';
import { PhotosController } from './photos.controller';
import { PhotosService } from './photos.service';

@Module({
  imports: [
    GoogleDriveModule,
    TypeOrmModule.forFeature([
      PhotoEntity,
      MonthlyPhotoArchiveEntity,
      MonthlyPhotoThumbnailArchiveEntity,
      CyclingActivityEntity
    ])
  ],
  controllers: [PhotosController],
  providers: [PhotoIngestService, MonthlyPhotoArchiveService, MonthlyPhotoThumbnailArchiveService, PhotosService],
  exports: [PhotosService]
})
export class PhotosModule {}
