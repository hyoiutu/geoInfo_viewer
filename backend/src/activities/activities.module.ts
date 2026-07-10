import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StravaModule } from '../strava/strava.module';
import { ActivitiesController } from './activities.controller';
import { ActivitiesService } from './activities.service';
import { ActivitiesBackfillService } from './activities-backfill.service';
import { CyclingActivityEntity } from './entities/cycling-activity.entity';
import { SyncStateEntity } from './entities/sync-state.entity';

@Module({
  imports: [StravaModule, TypeOrmModule.forFeature([CyclingActivityEntity, SyncStateEntity])],
  controllers: [ActivitiesController],
  providers: [ActivitiesService, ActivitiesBackfillService]
})
export class ActivitiesModule {}
