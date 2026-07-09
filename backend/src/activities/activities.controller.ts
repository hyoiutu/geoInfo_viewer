import { Controller, Get, Post } from '@nestjs/common';
import {
  ACTIVITIES_BACKFILL_ROUTE,
  ACTIVITIES_BACKFILL_STATUS_ROUTE,
  ACTIVITIES_ROUTE,
  ACTIVITIES_SYNC_ROUTE
} from './activities.constants';
import { ActivitiesService, type SyncResult } from './activities.service';
import {
  ActivitiesBackfillService,
  type BackfillStartResult,
  type BackfillStatus
} from './activities-backfill.service';
import type { CyclingActivityDto } from './types/cycling-activity.dto';

@Controller(ACTIVITIES_ROUTE)
export class ActivitiesController {
  constructor(
    private readonly activitiesService: ActivitiesService,
    private readonly activitiesBackfillService: ActivitiesBackfillService
  ) {}

  @Get()
  findAll(): Promise<CyclingActivityDto[]> {
    return this.activitiesService.findAll();
  }

  @Post(ACTIVITIES_SYNC_ROUTE)
  sync(): Promise<SyncResult> {
    return this.activitiesService.sync();
  }

  @Post(ACTIVITIES_BACKFILL_ROUTE)
  startBackfill(): Promise<BackfillStartResult> {
    return this.activitiesBackfillService.start();
  }

  @Get(ACTIVITIES_BACKFILL_STATUS_ROUTE)
  getBackfillStatus(): Promise<BackfillStatus> {
    return this.activitiesBackfillService.getStatus();
  }
}
