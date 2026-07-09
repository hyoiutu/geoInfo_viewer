import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { StravaActivitiesService } from './strava-activities.service';
import { StravaAuthService } from './strava-auth.service';
import { StravaRateLimiterService } from './strava-rate-limiter.service';

@Module({
  imports: [HttpModule],
  providers: [StravaAuthService, StravaActivitiesService, StravaRateLimiterService],
  exports: [StravaActivitiesService, StravaRateLimiterService]
})
export class StravaModule {}
