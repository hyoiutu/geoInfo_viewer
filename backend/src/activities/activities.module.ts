import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MunicipalitiesModule } from '../municipalities/municipalities.module';
import { PhotosModule } from '../photos/photos.module';
import { StravaModule } from '../strava/strava.module';
import { ActivitiesController } from './activities.controller';
import { ActivitiesService } from './activities.service';
import { ActivitiesBackfillService } from './activities-backfill.service';
import { CyclingActivityRepository } from './cycling-activity.repository';
import { CyclingActivityEntity } from './entities/cycling-activity.entity';
import { SyncStateEntity } from './entities/sync-state.entity';

@Module({
  imports: [
    StravaModule,
    MunicipalitiesModule,
    PhotosModule,
    TypeOrmModule.forFeature([CyclingActivityEntity, SyncStateEntity])
  ],
  controllers: [ActivitiesController],
  providers: [ActivitiesService, ActivitiesBackfillService, CyclingActivityRepository]
})
export class ActivitiesModule {}
