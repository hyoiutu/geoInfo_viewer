import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { toGoogleDriveApiException } from '../common/errors/google-drive-api.exception';
import {
  GOOGLE_DRIVE_API_BASE_URL,
  GOOGLE_DRIVE_FILE_METADATA_FIELDS,
  GOOGLE_DRIVE_UPLOAD_BASE_URL,
  GOOGLE_GRANT_TYPE_REFRESH_TOKEN,
  GOOGLE_OAUTH_TOKEN_URL
} from './google-drive.constants';
import type { GoogleDriveFileMetadata, GoogleTokenResponse } from './types/google-drive.type';

/** リフレッシュトークンによるアクセストークン再取得のパラメータ */
export type RefreshTokenParams = {
  clientId: string | undefined;
  clientSecret: string | undefined;
  refreshToken: string | undefined;
};

/**
 * Google Drive REST APIへの生のHTTPアクセスを担うクライアント。
 * 認証トークンのキャッシュ等の業務ロジックは持たず、HTTPリクエストの組み立てと
 * エラーのAppExceptionへの変換のみを責務とする（Strava実装のStravaApiClientと同型、Issue #23）。
 */
@Injectable()
export class GoogleDriveApiClient {
  constructor(private readonly httpService: HttpService) {}

  /**
   * 指定したファイルのメタデータ（ファイル名・MIMEタイプ・サイズ）を取得する
   * @param accessToken Google Driveのアクセストークン
   * @param fileId 対象のDriveファイルID
   * @returns ファイルメタデータ
   */
  async getFileMetadata(accessToken: string, fileId: string): Promise<GoogleDriveFileMetadata> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<GoogleDriveFileMetadata>(`${GOOGLE_DRIVE_API_BASE_URL}/files/${fileId}`, {
          // biome-ignore lint/style/useNamingConvention: HTTPヘッダー名の正規表記(Authorization)に合わせる
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { fields: GOOGLE_DRIVE_FILE_METADATA_FIELDS }
        })
      );

      return response.data;
    } catch (error) {
      throw toGoogleDriveApiException(error);
    }
  }

  /**
   * 指定したファイルの実体（バイナリ）をダウンロードする
   * @param accessToken Google Driveのアクセストークン
   * @param fileId 対象のDriveファイルID
   * @returns ファイルのバイナリ本体
   */
  async downloadFile(accessToken: string, fileId: string): Promise<Buffer> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<Buffer>(`${GOOGLE_DRIVE_API_BASE_URL}/files/${fileId}`, {
          // biome-ignore lint/style/useNamingConvention: HTTPヘッダー名の正規表記(Authorization)に合わせる
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { alt: 'media' },
          responseType: 'arraybuffer'
        })
      );

      return response.data;
    } catch (error) {
      throw toGoogleDriveApiException(error);
    }
  }

  /**
   * 空のファイルメタデータ（ファイル名のみ）を新規作成する。コンテンツ本体は
   * updateFileContentで別途アップロードする（Google Drive APIの仕様上、作成とアップロードが分離しているため）
   * @param accessToken Google Driveのアクセストークン
   * @param name 作成するファイルの名前
   * @returns 作成したファイルのID
   */
  async createFileMetadata(accessToken: string, name: string): Promise<string> {
    try {
      const response = await firstValueFrom(
        this.httpService.post<GoogleDriveFileMetadata>(
          `${GOOGLE_DRIVE_API_BASE_URL}/files`,
          { name },
          // biome-ignore lint/style/useNamingConvention: HTTPヘッダー名の正規表記(Authorization)に合わせる
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )
      );

      return response.data.id;
    } catch (error) {
      throw toGoogleDriveApiException(error);
    }
  }

  /**
   * 既存ファイルのコンテンツ（バイナリ本体）を更新する
   * @param accessToken Google Driveのアクセストークン
   * @param fileId 更新対象のDriveファイルID
   * @param content アップロードするバイナリ本体
   */
  async updateFileContent(accessToken: string, fileId: string, content: Buffer): Promise<void> {
    try {
      await firstValueFrom(
        this.httpService.patch(`${GOOGLE_DRIVE_UPLOAD_BASE_URL}/files/${fileId}`, content, {
          // biome-ignore lint/style/useNamingConvention: HTTPヘッダー名の正規表記(Authorization/Content-Type)に合わせる
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/zip' },
          params: { uploadType: 'media' }
        })
      );
    } catch (error) {
      throw toGoogleDriveApiException(error);
    }
  }

  /**
   * リフレッシュトークンを使い、Googleから新しいアクセストークンを取得する
   * @param params クライアントID・シークレット・リフレッシュトークン
   * @returns Googleのトークンレスポンス
   */
  async refreshToken(params: RefreshTokenParams): Promise<GoogleTokenResponse> {
    try {
      const response = await firstValueFrom(
        this.httpService.post<GoogleTokenResponse>(GOOGLE_OAUTH_TOKEN_URL, {
          // biome-ignore lint/style/useNamingConvention: Google APIのリクエストボディ形式(snake_case)に合わせる
          client_id: params.clientId,
          // biome-ignore lint/style/useNamingConvention: Google APIのリクエストボディ形式(snake_case)に合わせる
          client_secret: params.clientSecret,
          // biome-ignore lint/style/useNamingConvention: Google APIのリクエストボディ形式(snake_case)に合わせる
          refresh_token: params.refreshToken,
          // biome-ignore lint/style/useNamingConvention: Google APIのリクエストボディ形式(snake_case)に合わせる
          grant_type: GOOGLE_GRANT_TYPE_REFRESH_TOKEN
        })
      );

      return response.data;
    } catch (error) {
      throw toGoogleDriveApiException(error);
    }
  }
}
