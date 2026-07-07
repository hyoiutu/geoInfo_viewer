import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { STRAVA_ACTIVITIES_PATH, STRAVA_API_BASE_URL } from './strava.constants';
import { isCyclingActivity } from './strava-activity.util';
import { StravaAuthService } from './strava-auth.service';
import type { StravaActivity } from './types/strava-activity.type';

export type FetchActivitiesOptions = {
  afterEpochSeconds?: number;
};

@Injectable()
export class StravaActivitiesService {
  constructor(
    private readonly httpService: HttpService,
    private readonly stravaAuthService: StravaAuthService
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
}
