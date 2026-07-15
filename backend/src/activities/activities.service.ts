import { Injectable } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { StravaActivitiesService } from '../strava/strava-activities.service';
import { ActivitiesBackfillService } from './activities-backfill.service';
import { toCyclingActivityDto } from './cycling-activity-dto.util';
import { toCyclingActivityEntityFromDetail } from './cycling-activity-entity.util';
import { CyclingActivityEntity } from './entities/cycling-activity.entity';
import { SYNC_STATE_SINGLETON_ID, SyncStateEntity } from './entities/sync-state.entity';
import type { CyclingActivityDto } from './types/cycling-activity.dto';

const MILLISECONDS_PER_SECOND = 1000;
const NO_ACTIVITIES = 0;

/** sync()の実行結果 */
export class SyncResult {
  /** 新規アクティビティ取得が実行されたか（バックフィル実行中ガードでスキップした場合はfalse。実際のエラーは例外として投げる） */
  @ApiProperty({
    description:
      '新規アクティビティ取得が実行されたか（バックフィル実行中ガードでスキップした場合はfalse。実際のエラーは例外として投げる）'
  })
  success!: boolean;
}

/** 自転車ログ(サイクリングアクティビティ)の参照・Strava新規アクティビティ取得を行うサービス */
@Injectable()
export class ActivitiesService {
  constructor(
    private readonly stravaActivitiesService: StravaActivitiesService,
    private readonly activitiesBackfillService: ActivitiesBackfillService,
    @InjectRepository(CyclingActivityEntity)
    private readonly cyclingActivityRepository: Repository<CyclingActivityEntity>,
    @InjectRepository(SyncStateEntity)
    private readonly syncStateRepository: Repository<SyncStateEntity>
  ) {}

  /** @returns DBに保存済みの全自転車ログ */
  async findAll(): Promise<CyclingActivityDto[]> {
    const entities = await this.cyclingActivityRepository.find();
    return entities.map((entity) => toCyclingActivityDto(entity));
  }

  /**
   * 前回の新規アクティビティ取得時刻以降にStravaへ追加されたアクティビティを取得し、DBへ反映する。
   * バックフィル実行中の場合は、二重取得を避けるため何もせず終了する
   * @returns 新規アクティビティ取得結果
   */
  async sync(): Promise<SyncResult> {
    if (this.activitiesBackfillService.isRunning()) {
      return { success: false };
    }

    const syncState = await this.getOrCreateSyncState();
    const afterEpochSeconds =
      syncState.lastSyncedAt === null
        ? undefined
        : Math.floor(syncState.lastSyncedAt.getTime() / MILLISECONDS_PER_SECOND);

    const activities = await this.stravaActivitiesService.fetchCyclingActivities({ afterEpochSeconds });
    const entities: CyclingActivityEntity[] = [];
    for (const activity of activities) {
      const detail = await this.stravaActivitiesService.fetchCyclingActivityDetail(activity.id);
      entities.push(toCyclingActivityEntityFromDetail(detail));
    }
    if (entities.length > NO_ACTIVITIES) {
      await this.cyclingActivityRepository.save(entities);
    }

    syncState.lastSyncedAt = new Date();
    await this.syncStateRepository.save(syncState);

    return { success: true };
  }

  /** @returns 既存の新規アクティビティ取得状態。存在しない場合は初回取得を表す未保存のEntity */
  private async getOrCreateSyncState(): Promise<SyncStateEntity> {
    const existing = await this.syncStateRepository.findOneBy({ id: SYNC_STATE_SINGLETON_ID });
    if (existing !== null) {
      return existing;
    }

    return this.syncStateRepository.create({ id: SYNC_STATE_SINGLETON_ID, lastSyncedAt: null });
  }
}
