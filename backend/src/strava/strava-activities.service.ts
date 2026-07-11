import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { toStravaApiException } from '../common/errors/strava-api.exception';
import {
  STRAVA_ACTIVITIES_PATH,
  STRAVA_ACTIVITY_DETAIL_PATH,
  STRAVA_API_BASE_URL,
  STRAVA_MAX_PER_PAGE
} from './strava.constants';
import { isCyclingActivity } from './strava-activity.util';
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
    private readonly httpService: HttpService,
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

    try {
      const response = await firstValueFrom(
        this.httpService.get<StravaActivity[]>(`${STRAVA_API_BASE_URL}${STRAVA_ACTIVITIES_PATH}`, {
          // biome-ignore lint/style/useNamingConvention: HTTPヘッダー名の正規表記(Authorization)に合わせる
          headers: { Authorization: `Bearer ${accessToken}` },
          params: options.afterEpochSeconds === undefined ? undefined : { after: options.afterEpochSeconds }
        })
      );

      return response.data.filter((activity) => isCyclingActivity(activity));
    } catch (error) {
      throw toStravaApiException(error);
    }
  }

  /**
   * レート制限を守りながら、全ページを辿ってサイクリング系アクティビティを全件取得する。
   * 初期取り込み(バックフィル)のプレースホルダー作成に使う
   * @returns サイクリング系アクティビティの全件一覧
   */
  async fetchAllCyclingActivities(): Promise<StravaActivity[]> {
    const accessToken = await this.stravaAuthService.getAccessToken();
    const allActivities: StravaActivity[] = [];

    for (let page = FIRST_PAGE; ; page++) {
      await this.stravaRateLimiterService.waitForSlot();

      try {
        const response = await firstValueFrom(
          this.httpService.get<StravaActivity[]>(`${STRAVA_API_BASE_URL}${STRAVA_ACTIVITIES_PATH}`, {
            // biome-ignore lint/style/useNamingConvention: HTTPヘッダー名の正規表記(Authorization)に合わせる
            headers: { Authorization: `Bearer ${accessToken}` },
            // biome-ignore lint/style/useNamingConvention: Strava APIのクエリパラメータ形式(snake_case)に合わせる
            params: { per_page: STRAVA_MAX_PER_PAGE, page }
          })
        );

        if (response.data.length === EMPTY_PAGE_LENGTH) {
          break;
        }

        allActivities.push(...response.data.filter((activity) => isCyclingActivity(activity)));
      } catch (error) {
        throw toStravaApiException(error);
      }
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

    try {
      const response = await firstValueFrom(
        this.httpService.get<StravaActivityDetail>(`${STRAVA_API_BASE_URL}${STRAVA_ACTIVITY_DETAIL_PATH(activityId)}`, {
          // biome-ignore lint/style/useNamingConvention: HTTPヘッダー名の正規表記(Authorization)に合わせる
          headers: { Authorization: `Bearer ${accessToken}` }
        })
      );

      return response.data;
    } catch (error) {
      throw toStravaApiException(error);
    }
  }
}
