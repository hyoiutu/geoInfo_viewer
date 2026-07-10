import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { StravaActivitiesService } from '../strava/strava-activities.service';
import { StravaRateLimiterService } from '../strava/strava-rate-limiter.service';
import { toCyclingActivityEntityFromDetail, toPlaceholderCyclingActivityEntity } from './cycling-activity-entity.util';
import { CyclingActivityEntity } from './entities/cycling-activity.entity';

const MILLISECONDS_PER_SECOND = 1000;
const NO_ACTIVITIES = 0;

export type BackfillStartResult = {
  started: boolean;
};

export type BackfillStatus = {
  isRunning: boolean;
  totalCount: number;
  completedCount: number;
  progressPercent: number;
  estimatedRemainingSeconds: number | null;
};

@Injectable()
export class ActivitiesBackfillService {
  private running = false;

  constructor(
    private readonly stravaActivitiesService: StravaActivitiesService,
    private readonly stravaRateLimiterService: StravaRateLimiterService,
    @InjectRepository(CyclingActivityEntity)
    private readonly cyclingActivityRepository: Repository<CyclingActivityEntity>
  ) {}

  isRunning(): boolean {
    return this.running;
  }

  async start(): Promise<BackfillStartResult> {
    if (this.running) {
      return { started: false };
    }

    this.running = true;
    // fire-and-forget: エラーはHTTPレスポンスには返さず握りつぶし、isRunningを戻して次回startを可能にする
    this.runBackfill()
      .catch(() => {})
      .finally(() => {
        this.running = false;
      });

    return { started: true };
  }

  async getStatus(): Promise<BackfillStatus> {
    const totalCount = await this.cyclingActivityRepository.count();
    const completedCount = await this.cyclingActivityRepository.count({
      where: { detailFetchedAt: Not(IsNull()) }
    });
    const progressPercent = totalCount === NO_ACTIVITIES ? 0 : Math.round((completedCount / totalCount) * 100);
    const estimatedRemainingSeconds = this.running
      ? ((totalCount - completedCount) * this.stravaRateLimiterService.getIntervalMs()) / MILLISECONDS_PER_SECOND
      : null;

    return { isRunning: this.running, totalCount, completedCount, progressPercent, estimatedRemainingSeconds };
  }

  private async runBackfill(): Promise<void> {
    if (!(await this.isFullyBackfilled())) {
      await this.fetchAndSavePlaceholders();
    }

    const pendingEntities = await this.cyclingActivityRepository.find({ where: { detailFetchedAt: IsNull() } });
    for (const pendingEntity of pendingEntities) {
      const detail = await this.stravaActivitiesService.fetchCyclingActivityDetail(Number(pendingEntity.id));
      await this.cyclingActivityRepository.save(toCyclingActivityEntityFromDetail(detail));
    }
  }

  // 既に全件のdetailFetchedAtが埋まっている場合、Stravaへの全件一覧再取得（レート制限で数十秒かかる）は
  // 新規アクティビティの検出という意味しか持たない。新規アクティビティの検出は通常のsync()が担うため、
  // 一度完了した後の再実行はこれをスキップし即座に完了させる。
  private async isFullyBackfilled(): Promise<boolean> {
    const totalCount = await this.cyclingActivityRepository.count();
    if (totalCount === NO_ACTIVITIES) {
      return false;
    }
    const pendingCount = await this.cyclingActivityRepository.count({ where: { detailFetchedAt: IsNull() } });
    return pendingCount === NO_ACTIVITIES;
  }

  private async fetchAndSavePlaceholders(): Promise<void> {
    const activities = await this.stravaActivitiesService.fetchAllCyclingActivities();
    const existingIds = new Set((await this.cyclingActivityRepository.find()).map((entity) => entity.id));
    const newPlaceholders = activities
      .filter((activity) => !existingIds.has(String(activity.id)))
      .map((activity) => toPlaceholderCyclingActivityEntity(activity));

    if (newPlaceholders.length > NO_ACTIVITIES) {
      await this.cyclingActivityRepository.save(newPlaceholders);
    }
  }
}
