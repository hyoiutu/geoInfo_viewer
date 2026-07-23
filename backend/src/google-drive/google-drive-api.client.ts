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

// レジューマブルアップロードの1チャンクあたりのサイズ。Google Drive APIの仕様上256KiBの倍数にする必要がある。
// 月別アーカイブzip全体（数GBになりうる）を1回のPUTで送信すると、TLSの書き込みエラー(EPROTO)が
// 実際に発生した（写真ローカルバックフィルの実行時、Issue #23）ため、チャンクに分割して送信する
export const UPLOAD_CHUNK_SIZE_BYTES = 16 * 1024 * 1024;

// メタデータ取得・セッション開始等、軽量なリクエストのタイムアウト。
// axiosはtimeoutを指定しない限りリクエストが応答なく無限に待ち続けるため、
// ネットワーク接続がスタックした場合に永久にハングしてしまう問題が写真ローカルバックフィルの
// 実行時に実際に発生した（エラーも出ないままプロセスが進行しなくなる、Issue #23）
const GOOGLE_DRIVE_REQUEST_TIMEOUT_MS = 30 * 1000;
// 既存アーカイブのダウンロードは（チャンク分割していないため）数GBになりうるので、より長めに確保する
const GOOGLE_DRIVE_DOWNLOAD_TIMEOUT_MS = 5 * 60 * 1000;
// アップロードチャンク(16MiB)1回あたりのタイムアウト。低速回線でも完了しうる時間を確保しつつ、
// 応答が無いまま無限に待ち続けることは無いようにする
const UPLOAD_CHUNK_TIMEOUT_MS = 2 * 60 * 1000;

/**
 * Google Drive APIのレジューマブルアップロードにおいて、チャンクのPUTレスポンスとして正常とみなす
 * HTTPステータスかどうかを判定する。中間チャンクは200番台ではなく308（Resume Incomplete、
 * 「このチャンクは受理したので続きを送ってほしい」という独自の意味で使われる）を返すため、
 * axiosの既定のvalidateStatus（2xxのみ成功扱い）のままだとエラーとして扱われてしまう
 * @param status レスポンスのHTTPステータスコード
 * @returns 正常なレスポンスとみなす場合true
 */
const isValidUploadChunkStatus = (status: number): boolean => (status >= 200 && status < 300) || status === 308;

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
          params: { fields: GOOGLE_DRIVE_FILE_METADATA_FIELDS },
          timeout: GOOGLE_DRIVE_REQUEST_TIMEOUT_MS
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
          responseType: 'arraybuffer',
          timeout: GOOGLE_DRIVE_DOWNLOAD_TIMEOUT_MS
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
          {
            // biome-ignore lint/style/useNamingConvention: HTTPヘッダー名の正規表記(Authorization)に合わせる
            headers: { Authorization: `Bearer ${accessToken}` },
            timeout: GOOGLE_DRIVE_REQUEST_TIMEOUT_MS
          }
        )
      );

      return response.data.id;
    } catch (error) {
      throw toGoogleDriveApiException(error);
    }
  }

  /**
   * 既存ファイルのコンテンツ（バイナリ本体）を更新する。Google Drive APIの「シンプルアップロード」
   * （`uploadType=media`）は数MB程度までしか信頼できる動作を保証しないため、月別アーカイブzip
   * （数十MB〜数GBになりうる）を安定してアップロードできるよう「レジューマブルアップロード」方式を使う
   * （実際に502エラーで発覚、Issue #23）。
   * 1. セッション開始リクエスト（`uploadType=resumable`）を送り、レスポンスの`Location`ヘッダーから
   *    アップロード先セッションURLを取得する。Google公式ドキュメントの推奨に従い、ボディは空のJSON
   *    （`Content-Type: application/json`）とし、`X-Upload-Content-Type`/`X-Upload-Content-Length`
   *    でこれから送信する実バイナリの情報を明示する
   * 2. 取得したセッションURLへ、実際のバイナリ本体を`UPLOAD_CHUNK_SIZE_BYTES`ごとに分割して順にPUTする。
   *    内容全体を1回のPUTで送信する実装だった際、数GB規模のzipでTLSの書き込みエラー(EPROTO)が
   *    実際に発生したため、チャンク分割へ変更した。各チャンクには`Content-Range`ヘッダーで
   *    全体のうちどの範囲かを明示する。失敗時のチャンク単位の再開（途中のチャンクから再送する）は
   *    実装していない（失敗した場合はエラーとして呼び出し元へ伝播し、月単位で最初から再試行する）
   * 各リクエストには`timeout`を設定する。ネットワーク接続がスタックした場合、axiosはtimeout未指定だと
   * 応答を無限に待ち続けエラーにもならないため、プロセスがCPU/ネットワークどちらも使わず無音のまま
   * 進行しなくなる不具合が写真ローカルバックフィルの実行時に実際に発生した（Issue #23）
   * @param accessToken Google Driveのアクセストークン
   * @param fileId 更新対象のDriveファイルID
   * @param content アップロードするバイナリ本体
   * @param chunkSizeBytes 1チャンクあたりのサイズ。テストで小さい値へ差し替えられるよう引数化しているが、
   * 通常は省略しデフォルト（`UPLOAD_CHUNK_SIZE_BYTES`）を使うこと
   */
  async updateFileContent(
    accessToken: string,
    fileId: string,
    content: Buffer,
    chunkSizeBytes: number = UPLOAD_CHUNK_SIZE_BYTES
  ): Promise<void> {
    try {
      const sessionResponse = await firstValueFrom(
        this.httpService.patch(
          `${GOOGLE_DRIVE_UPLOAD_BASE_URL}/files/${fileId}`,
          {},
          {
            headers: {
              // biome-ignore lint/style/useNamingConvention: HTTPヘッダー名の正規表記(Authorization/Content-Type)に合わせる
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json; charset=UTF-8',
              'X-Upload-Content-Type': 'application/zip',
              'X-Upload-Content-Length': String(content.length)
            },
            params: { uploadType: 'resumable' },
            timeout: GOOGLE_DRIVE_REQUEST_TIMEOUT_MS
          }
        )
      );

      const uploadSessionUrl: string = sessionResponse.headers.location;
      for (let start = 0; start < content.length; start += chunkSizeBytes) {
        const end = Math.min(start + chunkSizeBytes, content.length);
        await firstValueFrom(
          this.httpService.put(uploadSessionUrl, content.subarray(start, end), {
            headers: {
              'Content-Type': 'application/zip',
              'Content-Range': `bytes ${start}-${end - 1}/${content.length}`
            },
            maxRedirects: 0,
            validateStatus: isValidUploadChunkStatus,
            timeout: UPLOAD_CHUNK_TIMEOUT_MS
          })
        );
      }
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
        this.httpService.post<GoogleTokenResponse>(
          GOOGLE_OAUTH_TOKEN_URL,
          {
            // biome-ignore lint/style/useNamingConvention: Google APIのリクエストボディ形式(snake_case)に合わせる
            client_id: params.clientId,
            // biome-ignore lint/style/useNamingConvention: Google APIのリクエストボディ形式(snake_case)に合わせる
            client_secret: params.clientSecret,
            // biome-ignore lint/style/useNamingConvention: Google APIのリクエストボディ形式(snake_case)に合わせる
            refresh_token: params.refreshToken,
            // biome-ignore lint/style/useNamingConvention: Google APIのリクエストボディ形式(snake_case)に合わせる
            grant_type: GOOGLE_GRANT_TYPE_REFRESH_TOKEN
          },
          { timeout: GOOGLE_DRIVE_REQUEST_TIMEOUT_MS }
        )
      );

      return response.data;
    } catch (error) {
      throw toGoogleDriveApiException(error);
    }
  }
}
