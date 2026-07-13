import { Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MunicipalitiesService, type PassedMunicipalityDto } from '../municipalities/municipalities.service';
import {
  ACTIVITIES_BACKFILL_FORCE_REFETCH_ROUTE,
  ACTIVITIES_BACKFILL_ROUTE,
  ACTIVITIES_BACKFILL_STATUS_ROUTE,
  ACTIVITIES_MUNICIPALITIES_ROUTE,
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

/** 自転車ログ(サイクリングアクティビティ)の参照・同期・初期取り込み・通過自治体取得に関するHTTP APIを提供するコントローラー */
@ApiTags('activities')
@Controller(ACTIVITIES_ROUTE)
export class ActivitiesController {
  constructor(
    private readonly activitiesService: ActivitiesService,
    private readonly activitiesBackfillService: ActivitiesBackfillService,
    private readonly municipalitiesService: MunicipalitiesService
  ) {}

  /** GET /activities: DBに保存済みの全自転車ログを返す */
  @Get()
  findAll(): Promise<CyclingActivityDto[]> {
    return this.activitiesService.findAll();
  }

  /** POST /activities/sync: Strava上の新規アクティビティを取得しDBへ反映する */
  @Post(ACTIVITIES_SYNC_ROUTE)
  sync(): Promise<SyncResult> {
    return this.activitiesService.sync();
  }

  /** POST /activities/backfill: 初期取り込み(バックフィル)を開始する */
  @Post(ACTIVITIES_BACKFILL_ROUTE)
  startBackfill(): Promise<BackfillStartResult> {
    return this.activitiesBackfillService.start();
  }

  /** GET /activities/backfill/status: 初期取り込みの進捗状況を返す */
  @Get(ACTIVITIES_BACKFILL_STATUS_ROUTE)
  getBackfillStatus(): Promise<BackfillStatus> {
    return this.activitiesBackfillService.getStatus();
  }

  /** POST /activities/backfill/force-refetch: 既存全アクティビティの詳細を強制的に再取得する */
  @Post(ACTIVITIES_BACKFILL_FORCE_REFETCH_ROUTE)
  startForceRefetch(): Promise<BackfillStartResult> {
    return this.activitiesBackfillService.startForceRefetch();
  }

  /** GET /activities/:id/municipalities: 指定したアクティビティが通過した自治体一覧を返す */
  @Get(ACTIVITIES_MUNICIPALITIES_ROUTE)
  getPassedMunicipalities(@Param('id') id: string): Promise<PassedMunicipalityDto[]> {
    return this.municipalitiesService.findPassedMunicipalities(id);
  }
}
