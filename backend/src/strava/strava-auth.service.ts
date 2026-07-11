import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { toStravaApiException } from '../common/errors/strava-api.exception';
import {
  STRAVA_GRANT_TYPE_REFRESH_TOKEN,
  STRAVA_OAUTH_TOKEN_URL,
  TOKEN_EXPIRY_BUFFER_SECONDS
} from './strava.constants';
import type { StravaTokenResponse } from './types/strava-activity.type';

/** 保持中のアクセストークンの状態 */
type TokenState = {
  /** アクセストークン */
  accessToken: string;
  /** アクセストークンの失効日時（epoch秒） */
  expiresAtEpochSeconds: number;
};

/** Stravaのアクセストークンを取得・キャッシュし、必要に応じてリフレッシュトークンで更新するサービス */
@Injectable()
export class StravaAuthService {
  private tokenState: TokenState | null = null;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService
  ) {}

  /**
   * 有効なアクセストークンを返す。キャッシュ済みトークンが無い・失効している場合はリフレッシュする
   * @returns Stravaのアクセストークン
   */
  async getAccessToken(): Promise<string> {
    if (this.tokenState && !this.isExpired(this.tokenState)) {
      return this.tokenState.accessToken;
    }

    this.tokenState = await this.refreshAccessToken();
    return this.tokenState.accessToken;
  }

  /**
   * トークンが失効しているか（失効バッファを考慮して）判定する
   * @param tokenState 判定対象のトークン状態
   * @returns 失効していればtrue
   */
  private isExpired(tokenState: TokenState): boolean {
    const nowEpochSeconds = Math.floor(Date.now() / 1000);
    return nowEpochSeconds >= tokenState.expiresAtEpochSeconds - TOKEN_EXPIRY_BUFFER_SECONDS;
  }

  /**
   * リフレッシュトークンを使ってStravaから新しいアクセストークンを取得する
   * @returns 新しいトークン状態
   */
  private async refreshAccessToken(): Promise<TokenState> {
    try {
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
    } catch (error) {
      throw toStravaApiException(error);
    }
  }
}
