import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
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

export type FetchActivitiesOptions = {
  afterEpochSeconds?: number;
};

const FIRST_PAGE = 1;
const EMPTY_PAGE_LENGTH = 0;

@Injectable()
export class StravaActivitiesService {
  constructor(
    private readonly httpService: HttpService,
    private readonly stravaAuthService: StravaAuthService,
    private readonly stravaRateLimiterService: StravaRateLimiterService
  ) {}

  async fetchCyclingActivities(options: FetchActivitiesOptions = {}): Promise<StravaActivity[]> {
    const accessToken = await this.stravaAuthService.getAccessToken();

    const response = await firstValueFrom(
      this.httpService.get<StravaActivity[]>(`${STRAVA_API_BASE_URL}${STRAVA_ACTIVITIES_PATH}`, {
        // biome-ignore lint/style/useNamingConvention: HTTPヘッダー名の正規表記(Authorization)に合わせる
        headers: { Authorization: `Bearer ${accessToken}` },
        params: options.afterEpochSeconds === undefined ? undefined : { after: options.afterEpochSeconds }
      })
    );

    return response.data.filter((activity) => isCyclingActivity(activity));
  }

  async fetchAllCyclingActivities(): Promise<StravaActivity[]> {
    const accessToken = await this.stravaAuthService.getAccessToken();
    const allActivities: StravaActivity[] = [];

    for (let page = FIRST_PAGE; ; page++) {
      await this.stravaRateLimiterService.waitForSlot();

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
    }

    return allActivities;
  }

  async fetchCyclingActivityDetail(activityId: number): Promise<StravaActivityDetail> {
    const accessToken = await this.stravaAuthService.getAccessToken();
    await this.stravaRateLimiterService.waitForSlot();

    const response = await firstValueFrom(
      this.httpService.get<StravaActivityDetail>(`${STRAVA_API_BASE_URL}${STRAVA_ACTIVITY_DETAIL_PATH(activityId)}`, {
        // biome-ignore lint/style/useNamingConvention: HTTPヘッダー名の正規表記(Authorization)に合わせる
        headers: { Authorization: `Bearer ${accessToken}` }
      })
    );

    return response.data;
  }
}
