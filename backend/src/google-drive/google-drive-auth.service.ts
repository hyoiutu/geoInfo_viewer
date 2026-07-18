import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TOKEN_EXPIRY_BUFFER_SECONDS } from './google-drive.constants';
import { GoogleDriveApiClient } from './google-drive-api.client';

/** 保持中のアクセストークンの状態 */
type TokenState = {
  /** アクセストークン */
  accessToken: string;
  /** アクセストークンの失効日時（epoch秒） */
  expiresAtEpochSeconds: number;
};

/** Google Driveのアクセストークンを取得・キャッシュし、必要に応じてリフレッシュトークンで更新するサービス */
@Injectable()
export class GoogleDriveAuthService {
  private tokenState: TokenState | null = null;

  constructor(
    private readonly googleDriveApiClient: GoogleDriveApiClient,
    private readonly configService: ConfigService
  ) {}

  /**
   * 有効なアクセストークンを返す。キャッシュ済みトークンが無い・失効している場合はリフレッシュする
   * @returns Google Driveのアクセストークン
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
   * リフレッシュトークンを使ってGoogleから新しいアクセストークンを取得する
   * @returns 新しいトークン状態
   */
  private async refreshAccessToken(): Promise<TokenState> {
    const tokenResponse = await this.googleDriveApiClient.refreshToken({
      clientId: this.configService.get<string>('GOOGLE_CLIENT_ID'),
      clientSecret: this.configService.get<string>('GOOGLE_CLIENT_SECRET'),
      refreshToken: this.configService.get<string>('GOOGLE_REFRESH_TOKEN')
    });

    const nowEpochSeconds = Math.floor(Date.now() / 1000);
    return {
      accessToken: tokenResponse.access_token,
      expiresAtEpochSeconds: nowEpochSeconds + tokenResponse.expires_in
    };
  }
}
