import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import {
  STRAVA_GRANT_TYPE_REFRESH_TOKEN,
  STRAVA_OAUTH_TOKEN_URL,
  TOKEN_EXPIRY_BUFFER_SECONDS
} from './strava.constants';
import type { StravaTokenResponse } from './types/strava-activity.type';

type TokenState = {
  accessToken: string;
  expiresAtEpochSeconds: number;
};

@Injectable()
export class StravaAuthService {
  private tokenState: TokenState | null = null;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService
  ) {}

  async getAccessToken(): Promise<string> {
    if (this.tokenState && !this.isExpired(this.tokenState)) {
      return this.tokenState.accessToken;
    }

    this.tokenState = await this.refreshAccessToken();
    return this.tokenState.accessToken;
  }

  private isExpired(tokenState: TokenState): boolean {
    const nowEpochSeconds = Math.floor(Date.now() / 1000);
    return nowEpochSeconds >= tokenState.expiresAtEpochSeconds - TOKEN_EXPIRY_BUFFER_SECONDS;
  }

  private async refreshAccessToken(): Promise<TokenState> {
    const response = await firstValueFrom(
      this.httpService.post<StravaTokenResponse>(STRAVA_OAUTH_TOKEN_URL, {
        // biome-ignore lint/style/useNamingConvention: Strava APIのリクエストボディ形式(snake_case)に合わせる
        client_id: this.configService.get<string>('STRAVA_CLIENT_ID'),
        // biome-ignore lint/style/useNamingConvention: Strava APIのリクエストボディ形式(snake_case)に合わせる
        client_secret: this.configService.get<string>('STRAVA_CLIENT_SECRET'),
        // biome-ignore lint/style/useNamingConvention: Strava APIのリクエストボディ形式(snake_case)に合わせる
        refresh_token: this.configService.get<string>('STRAVA_REFRESH_TOKEN'),
        // biome-ignore lint/style/useNamingConvention: Strava APIのリクエストボディ形式(snake_case)に合わせる
        grant_type: STRAVA_GRANT_TYPE_REFRESH_TOKEN
      })
    );

    return {
      accessToken: response.data.access_token,
      expiresAtEpochSeconds: response.data.expires_at
    };
  }
}
