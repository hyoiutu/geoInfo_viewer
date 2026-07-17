import { Injectable } from '@nestjs/common';
import { STRAVA_MAX_PER_PAGE } from './strava.constants';
import { isCyclingActivity } from './strava-activity.util';
import { StravaApiClient } from './strava-api.client';
import { StravaAuthService } from './strava-auth.service';
import { StravaRateLimiterService } from './strava-rate-limiter.service';
import type { StravaActivity, StravaActivityDetail } from './types/strava-activity.type';

/** fetchCyclingActivitiesの取得オプション */
export type FetchActivitiesOptions = {
  /** 指定した場合、このepoch秒以降に更新されたアクティビティのみを取得する（未指定の場合は全件） */
  afterEpochSeconds?: number;
};

const FIRST_PAGE = 1;
const EMPTY_PAGE_LENGTH = 0;

/** Strava APIからサイクリング系アクティビティの一覧・詳細を取得するサービス */
@Injectable()
export class StravaActivitiesService {
  constructor(
    private readonly stravaApiClient: StravaApiClient,
    private readonly stravaAuthService: StravaAuthService,
    private readonly stravaRateLimiterService: StravaRateLimiterService
  ) {}

  /**
   * アクティビティ一覧を取得し、サイクリング系（Ride/VirtualRide）のみに絞り込んで返す
   * @param options 取得オプション
   * @returns サイクリング系アクティビティの一覧
   */
  async fetchCyclingActivities(options: FetchActivitiesOptions = {}): Promise<StravaActivity[]> {
    const accessToken = await this.stravaAuthService.getAccessToken();

    const activities = await this.stravaApiClient.getActivities(accessToken, {
      afterEpochSeconds: options.afterEpochSeconds
    });

    return activities.filter((activity) => isCyclingActivity(activity));
  }

  /**
   * レート制限を守りながら、全ページを辿ってサイクリング系アクティビティを全件取得する。
   * バックフィルのプレースホルダー作成に使う
   * @returns サイクリング系アクティビティの全件一覧
   */
  async fetchAllCyclingActivities(): Promise<StravaActivity[]> {
    const accessToken = await this.stravaAuthService.getAccessToken();
    const allActivities: StravaActivity[] = [];

    for (let page = FIRST_PAGE; ; page++) {
      await this.stravaRateLimiterService.waitForSlot();

      const activities = await this.stravaApiClient.getActivities(accessToken, { perPage: STRAVA_MAX_PER_PAGE, page });

      if (activities.length === EMPTY_PAGE_LENGTH) {
        break;
      }

      allActivities.push(...activities.filter((activity) => isCyclingActivity(activity)));
    }

    return allActivities;
  }

  /**
   * 指定したアクティビティの詳細（高解像度の軌跡を含む）を取得する
   * @param activityId 対象のStravaアクティビティID
   * @returns アクティビティ詳細
   */
  async fetchCyclingActivityDetail(activityId: number): Promise<StravaActivityDetail> {
    const accessToken = await this.stravaAuthService.getAccessToken();
    await this.stravaRateLimiterService.waitForSlot();

    return this.stravaApiClient.getActivityDetail(accessToken, activityId);
  }
}
