import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, type Repository } from 'typeorm';
import type { AppErrorInfo } from '../common/errors/app-error-info.type';
import { toAppErrorInfo } from '../common/errors/app-error-info.util';
import { StravaActivitiesService } from '../strava/strava-activities.service';
import { StravaRateLimiterService } from '../strava/strava-rate-limiter.service';
import { toCyclingActivityEntityFromDetail, toPlaceholderCyclingActivityEntity } from './cycling-activity-entity.util';
import { CyclingActivityEntity } from './entities/cycling-activity.entity';

const MILLISECONDS_PER_SECOND = 1000;
const NO_ACTIVITIES = 0;

/** start()の実行結果 */
export type BackfillStartResult = {
  /** 新たに初期取り込みを開始したか（既に実行中だった場合はfalse） */
  started: boolean;
};

/** getStatus()が返す初期取り込みの進捗状況 */
export type BackfillStatus = {
  /** 現在実行中かどうか */
  isRunning: boolean;
  /** DBに存在するアクティビティの総数 */
  totalCount: number;
  /** うち詳細取得が完了した件数 */
  completedCount: number;
  /** 進捗率（%） */
  progressPercent: number;
  /** 完了までの推定残り秒数。実行中でない場合はnull */
  estimatedRemainingSeconds: number | null;
  /** 直近の実行で発生したエラー。発生していない場合はnull */
  lastError: AppErrorInfo | null;
};

/** 自転車ログの初期取り込み(バックフィル)を行うサービス */
@Injectable()
export class ActivitiesBackfillService {
  private running = false;
  private lastError: AppErrorInfo | null = null;

  constructor(
    private readonly stravaActivitiesService: StravaActivitiesService,
    private readonly stravaRateLimiterService: StravaRateLimiterService,
    @InjectRepository(CyclingActivityEntity)
    private readonly cyclingActivityRepository: Repository<CyclingActivityEntity>
  ) {}

  /** @returns 初期取り込みが実行中かどうか */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * 初期取り込みを開始する。既に実行中の場合は何もしない（二重起動防止）。
   * 処理自体はfire-and-forget（このメソッドは開始できたかどうかのみを返し、完了を待たない）
   * @returns 開始結果
   */
  async start(): Promise<BackfillStartResult> {
    if (this.running) {
      return { started: false };
    }

    this.running = true;
    this.lastError = null;
    // fire-and-forget: エラーはHTTPレスポンスには返さず、lastErrorに記録した上でgetStatus()経由で参照可能にする。
    // isRunningは戻して次回startを可能にする
    this.runBackfill()
      .catch((error: unknown) => {
        this.lastError = toAppErrorInfo(error);
      })
      .finally(() => {
        this.running = false;
      });

    return { started: true };
  }

  /** @returns 現在の初期取り込み進捗状況 */
  async getStatus(): Promise<BackfillStatus> {
    const totalCount = await this.cyclingActivityRepository.count();
    const completedCount = await this.cyclingActivityRepository.count({
      where: { detailFetchedAt: Not(IsNull()) }
    });
    const progressPercent = totalCount === NO_ACTIVITIES ? 0 : Math.round((completedCount / totalCount) * 100);
    const estimatedRemainingSeconds = this.running
      ? ((totalCount - completedCount) * this.stravaRateLimiterService.getIntervalMs()) / MILLISECONDS_PER_SECOND
      : null;

    return {
      isRunning: this.running,
      totalCount,
      completedCount,
      progressPercent,
      estimatedRemainingSeconds,
      lastError: this.lastError
    };
  }

  /** プレースホルダーの作成（未実施の場合）と、未取得分の詳細取得を順に行う */
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

  /**
   * 既に全件のdetailFetchedAtが埋まっている場合、Stravaへの全件一覧再取得（レート制限で数十秒かかる）は
   * 新規アクティビティの検出という意味しか持たない。新規アクティビティの検出は通常のsync()が担うため、
   * 一度完了した後の再実行はこれをスキップし即座に完了させる。
   * @returns 未取得のアクティビティが1件も無ければtrue
   */
  private async isFullyBackfilled(): Promise<boolean> {
    const totalCount = await this.cyclingActivityRepository.count();
    if (totalCount === NO_ACTIVITIES) {
      return false;
    }
    const pendingCount = await this.cyclingActivityRepository.count({ where: { detailFetchedAt: IsNull() } });
    return pendingCount === NO_ACTIVITIES;
  }

  /** Stravaのアクティビティ一覧を取得し、DB未登録の分だけプレースホルダーとして保存する */
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
