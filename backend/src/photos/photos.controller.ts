import { Body, Controller, Get, NotFoundException, Param, ParseIntPipe, Post, StreamableFile } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PhotoIngestService } from './photo-ingest.service';
import { PHOTOS_IMAGE_ROUTE, PHOTOS_INGEST_ROUTE, PHOTOS_ROUTE } from './photos.constants';
import { PhotosService } from './photos.service';
import type { PhotoIngestResultDto } from './types/photo-ingest-result.dto';

/** Google Takeoutの写真データ取り込み・写真バイナリの配信に関するHTTP APIを提供するコントローラー */
@ApiTags('photos')
@Controller(PHOTOS_ROUTE)
export class PhotosController {
  constructor(
    private readonly photoIngestService: PhotoIngestService,
    private readonly photosService: PhotosService
  ) {}

  /** POST /photos/ingest: 指定したGoogle Drive上のTakeout zipを取り込む */
  @Post(PHOTOS_INGEST_ROUTE)
  ingest(@Body('fileId') fileId: string): Promise<PhotoIngestResultDto> {
    return this.photoIngestService.ingest(fileId);
  }

  /** GET /photos/:id/image: 指定した写真IDのバイナリ本体を、月別アーカイブzipから遅延取得して返す */
  @Get(PHOTOS_IMAGE_ROUTE)
  async getImage(@Param('id', ParseIntPipe) id: number): Promise<StreamableFile> {
    const image = await this.photosService.findImageByPhotoId(id);
    if (image === null) {
      throw new NotFoundException();
    }
    return new StreamableFile(image.data, { type: image.contentType });
  }
}
