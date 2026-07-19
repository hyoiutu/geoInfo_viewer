import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GoogleDriveModule } from '../google-drive/google-drive.module';
import { PhotoEntity } from './entities/photo.entity';
import { PhotoIngestService } from './photo-ingest.service';
import { PhotosController } from './photos.controller';

@Module({
  imports: [GoogleDriveModule, TypeOrmModule.forFeature([PhotoEntity])],
  controllers: [PhotosController],
  providers: [PhotoIngestService]
})
export class PhotosModule {}
