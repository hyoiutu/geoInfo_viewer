import { Controller, Get } from '@nestjs/common';
import { ACTIVITIES_ROUTE } from './activities.constants';
import { ActivitiesService } from './activities.service';
import type { CyclingActivityDto } from './types/cycling-activity.dto';

@Controller(ACTIVITIES_ROUTE)
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get()
  findAll(): Promise<CyclingActivityDto[]> {
    return this.activitiesService.findAll();
  }
}
