import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { toStravaApiException } from '../common/errors/strava-api.exception';
import {
  STRAVA_ACTIVITIES_PATH,
  STRAVA_ACTIVITY_DETAIL_PATH,
  STRAVA_API_BASE_URL,
  STRAVA_GRANT_TYPE_REFRESH_TOKEN,
  STRAVA_OAUTH_TOKEN_URL
} from './strava.constants';
import type { StravaActivity, StravaActivityDetail, StravaTokenResponse } from './types/strava-activity.type';

/** アクティビティ一覧取得時のクエリパラメータ */
export type GetActivitiesParams = {
  /** 指定した場合、このepoch秒以降に更新されたアクティビティのみを取得する */
  afterEpochSeconds?: number;
  /** 1ページあたりの件数 */
  perPage?: number;
  /** ページ番号(1始まり) */
  page?: number;
};

/** リフレッシュトークンによるアクセストークン再取得のパラメータ */
export type RefreshTokenParams = {
  clientId: string | undefined;
  clientSecret: string | undefined;
  refreshToken: string | undefined;
};

/**
 * Strava REST APIへの生のHTTPアクセスを担うクライアント。
 * 認証トークンのキャッシュ・ページング・アクティビティ種別によるフィルタリング等の業務ロジックは持たず、
 * HTTPリクエストの組み立てとエラーのAppExceptionへの変換のみを責務とする（Issue #52）。
 */
@Injectable()
export class StravaApiClient {
  constructor(private readonly httpService: HttpService) {}

  /**
   * アクティビティ一覧を取得する
   * @param accessToken Stravaのアクセストークン
   * @param params 取得オプション
   * @returns Strava APIが返すアクティビティ一覧（フィルタリング前）
   */
  async getActivities(accessToken: string, params: GetActivitiesParams = {}): Promise<StravaActivity[]> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<StravaActivity[]>(`${STRAVA_API_BASE_URL}${STRAVA_ACTIVITIES_PATH}`, {
          // biome-ignore lint/style/useNamingConvention: HTTPヘッダー名の正規表記(Authorization)に合わせる
          headers: { Authorization: `Bearer ${accessToken}` },
          params: this.toActivitiesQueryParams(params)
        })
      );

      return response.data;
    } catch (error) {
      throw toStravaApiException(error);
    }
  }

  /**
   * 指定したアクティビティの詳細（高解像度の軌跡を含む）を取得する
   * @param accessToken Stravaのアクセストークン
   * @param activityId 対象のStravaアクティビティID
   * @returns アクティビティ詳細
   */
  async getActivityDetail(accessToken: string, activityId: number): Promise<StravaActivityDetail> {
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

  /**
   * リフレッシュトークンを使い、Stravaから新しいアクセストークンを取得する
   * @param params クライアントID・シークレット・リフレッシュトークン
   * @returns Stravaのトークンレスポンス
   */
  async refreshToken(params: RefreshTokenParams): Promise<StravaTokenResponse> {
    try {
      const response = await firstValueFrom(
        this.httpService.post<StravaTokenResponse>(STRAVA_OAUTH_TOKEN_URL, {
          // biome-ignore lint/style/useNamingConvention: Strava APIのリクエストボディ形式(snake_case)に合わせる
          client_id: params.clientId,
          // biome-ignore lint/style/useNamingConvention: Strava APIのリクエストボディ形式(snake_case)に合わせる
          client_secret: params.clientSecret,
          // biome-ignore lint/style/useNamingConvention: Strava APIのリクエストボディ形式(snake_case)に合わせる
          refresh_token: params.refreshToken,
          // biome-ignore lint/style/useNamingConvention: Strava APIのリクエストボディ形式(snake_case)に合わせる
          grant_type: STRAVA_GRANT_TYPE_REFRESH_TOKEN
        })
      );

      return response.data;
    } catch (error) {
      throw toStravaApiException(error);
    }
  }

  /**
   * アクティビティ一覧取得オプションを、Strava APIのクエリパラメータ形式(snake_case)へ変換する
   * @param params 取得オプション
   * @returns クエリパラメータ。何も指定されていない場合はundefined
   */
  private toActivitiesQueryParams(params: GetActivitiesParams): Record<string, number> | undefined {
    const query: Record<string, number> = {};
    if (params.afterEpochSeconds !== undefined) {
      query.after = params.afterEpochSeconds;
    }
    if (params.perPage !== undefined) {
      query.per_page = params.perPage;
    }
    if (params.page !== undefined) {
      query.page = params.page;
    }

    return Object.keys(query).length === 0 ? undefined : query;
  }
}
