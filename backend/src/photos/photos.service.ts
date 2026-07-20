import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, type Repository } from 'typeorm';
import { CyclingActivityEntity } from '../activities/entities/cycling-activity.entity';
import { PhotoEntity } from './entities/photo.entity';
import { toPhotoDto } from './photo-dto.util';
import type { PhotoDto } from './types/photo.dto';

const MILLISECONDS_PER_SECOND = 1000;

/**
 * アクティビティの開始・終了日時をもとに、その期間に撮影された写真を検索するサービス
 */
@Injectable()
export class PhotosService {
  constructor(
    @InjectRepository(CyclingActivityEntity)
    private readonly cyclingActivityRepository: Repository<CyclingActivityEntity>,
    @InjectRepository(PhotoEntity)
    private readonly photoRepository: Repository<PhotoEntity>
  ) {}

  /**
   * 指定したアクティビティの開始日時〜終了日時（開始日時+経過時間）の範囲で撮影された写真を、
   * 撮影日時の昇順で返す。位置情報を持たない写真もそのまま含める（location: null、Issue #23）
   * @param activityId 対象のアクティビティID
   * @returns 期間内に撮影された写真一覧（撮影日時昇順）。アクティビティが存在しない場合は空配列
   */
  async findByActivity(activityId: string): Promise<PhotoDto[]> {
    const activity = await this.cyclingActivityRepository.findOneBy({ id: activityId });
    if (activity === null) {
      return [];
    }

    const endDate = new Date(activity.startDate.getTime() + activity.elapsedTimeSeconds * MILLISECONDS_PER_SECOND);

    const photos = await this.photoRepository.find({
      where: { takenAt: Between(activity.startDate, endDate) },
      order: { takenAt: 'ASC' }
    });
    return photos.map((photo) => toPhotoDto(photo));
  }
}
