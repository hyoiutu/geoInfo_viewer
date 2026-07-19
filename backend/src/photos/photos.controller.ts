import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PhotoIngestService } from './photo-ingest.service';
import { PHOTOS_INGEST_ROUTE, PHOTOS_ROUTE } from './photos.constants';
import type { PhotoIngestResultDto } from './types/photo-ingest-result.dto';

/** Google Takeoutの写真データ取り込みに関するHTTP APIを提供するコントローラー */
@ApiTags('photos')
@Controller(PHOTOS_ROUTE)
export class PhotosController {
  constructor(private readonly photoIngestService: PhotoIngestService) {}

  /** POST /photos/ingest: 指定したGoogle Drive上のTakeout zipを取り込む */
  @Post(PHOTOS_INGEST_ROUTE)
  ingest(@Body('fileId') fileId: string): Promise<PhotoIngestResultDto> {
    return this.photoIngestService.ingest(fileId);
  }
}
