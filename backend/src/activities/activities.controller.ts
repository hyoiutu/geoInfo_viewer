import { Controller, Get, Post } from '@nestjs/common';
import { ACTIVITIES_ROUTE, ACTIVITIES_SYNC_ROUTE } from './activities.constants';
import { ActivitiesService, type SyncResult } from './activities.service';
import type { CyclingActivityDto } from './types/cycling-activity.dto';

@Controller(ACTIVITIES_ROUTE)
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get()
  findAll(): Promise<CyclingActivityDto[]> {
    return this.activitiesService.findAll();
  }

  @Post(ACTIVITIES_SYNC_ROUTE)
  sync(): Promise<SyncResult> {
    return this.activitiesService.sync();
  }
}
