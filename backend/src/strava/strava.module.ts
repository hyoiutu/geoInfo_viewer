import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { StravaActivitiesService } from './strava-activities.service';
import { StravaAuthService } from './strava-auth.service';

@Module({
  imports: [HttpModule],
  providers: [StravaAuthService, StravaActivitiesService],
  exports: [StravaActivitiesService]
})
export class StravaModule {}
