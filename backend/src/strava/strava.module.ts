import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { StravaActivitiesService } from './strava-activities.service';
import { StravaApiClient } from './strava-api.client';
import { StravaAuthService } from './strava-auth.service';
import { StravaRateLimiterService } from './strava-rate-limiter.service';

@Module({
  imports: [HttpModule],
  providers: [StravaApiClient, StravaAuthService, StravaActivitiesService, StravaRateLimiterService],
  exports: [StravaActivitiesService, StravaRateLimiterService]
})
export class StravaModule {}
