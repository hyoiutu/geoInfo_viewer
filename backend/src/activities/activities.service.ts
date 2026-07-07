import { Injectable } from '@nestjs/common';
import { StravaActivitiesService } from '../strava/strava-activities.service';
import { toCyclingActivityDto } from './cycling-activity.util';
import type { CyclingActivityDto } from './types/cycling-activity.dto';

@Injectable()
export class ActivitiesService {
  constructor(private readonly stravaActivitiesService: StravaActivitiesService) {}

  async findAll(): Promise<CyclingActivityDto[]> {
    const activities = await this.stravaActivitiesService.fetchCyclingActivities();
    return activities.map((activity) => toCyclingActivityDto(activity));
  }
}
