import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StravaActivitiesService } from '../strava/strava-activities.service';
import { ActivitiesBackfillService } from './activities-backfill.service';
import { toCyclingActivityDto } from './cycling-activity-dto.util';
import { toCyclingActivityEntityFromDetail } from './cycling-activity-entity.util';
import { CyclingActivityEntity } from './entities/cycling-activity.entity';
import { SYNC_STATE_SINGLETON_ID, SyncStateEntity } from './entities/sync-state.entity';
import type { CyclingActivityDto } from './types/cycling-activity.dto';

const MILLISECONDS_PER_SECOND = 1000;
const NO_ACTIVITIES = 0;

export type SyncResult = {
  success: boolean;
};

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

  async findAll(): Promise<CyclingActivityDto[]> {
    const entities = await this.cyclingActivityRepository.find();
    return entities.map((entity) => toCyclingActivityDto(entity));
  }

  async sync(): Promise<SyncResult> {
    if (this.activitiesBackfillService.isRunning()) {
      return { success: false };
    }

    try {
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
    } catch {
      return { success: false };
    }
  }

  private async getOrCreateSyncState(): Promise<SyncStateEntity> {
    const existing = await this.syncStateRepository.findOneBy({ id: SYNC_STATE_SINGLETON_ID });
    if (existing !== null) {
      return existing;
    }

    return this.syncStateRepository.create({ id: SYNC_STATE_SINGLETON_ID, lastSyncedAt: null });
  }
}
