import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StravaActivitiesService } from '../strava/strava-activities.service';
import { toCyclingActivityDto } from './cycling-activity-dto.util';
import { toCyclingActivityEntity } from './cycling-activity-entity.util';
import { CyclingActivityEntity } from './entities/cycling-activity.entity';
import { SYNC_STATE_SINGLETON_ID, SyncStateEntity } from './entities/sync-state.entity';
import type { CyclingActivityDto } from './types/cycling-activity.dto';

const MILLISECONDS_PER_SECOND = 1000;

export type SyncResult = {
  success: boolean;
};

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly stravaActivitiesService: StravaActivitiesService,
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
    try {
      const syncState = await this.getOrCreateSyncState();
      const afterEpochSeconds =
        syncState.lastSyncedAt === null
          ? undefined
          : Math.floor(syncState.lastSyncedAt.getTime() / MILLISECONDS_PER_SECOND);

      const activities = await this.stravaActivitiesService.fetchCyclingActivities({ afterEpochSeconds });
      const entities = activities.map((activity) => toCyclingActivityEntity(activity));
      if (entities.length > 0) {
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
