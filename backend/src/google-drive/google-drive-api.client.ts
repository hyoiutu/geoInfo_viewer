import { createWriteStream } from 'node:fs';
import { open } from 'node:fs/promises';
import type { Readable } from 'node:stream';
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
// downloadFileToPath（ストリーミングダウンロード）専用のタイムアウト。動画削除・part統合処理
// （Issue #99）では、旧実装の2GiB安全弁により実際には試されたことがなかった数GB〜十数GB規模の
// 単一ファイルダウンロードが発生しうる。実際に約9.3GiBの単一アーカイブ（2020-09）のダウンロードが
// GOOGLE_DRIVE_DOWNLOAD_TIMEOUT_MS（5分）内に完了せず、末尾が欠落したファイルのまま
// ダウンロードが「成功」として扱われてしまう不具合が発生したため、より長い時間を確保する
const GOOGLE_DRIVE_STREAMING_TRANSFER_TIMEOUT_MS = 120 * 60 * 1000;
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
   * 指定したファイルの実体（バイナリ）を、メモリ上へ全体を保持せずディスク上の指定パスへ
   * ストリーミングでダウンロードする。`downloadFile`（Bufferとして全体をメモリへ返す）と異なり、
   * 月合計サイズが数GB〜十数GBになりうる月別アーカイブzipの動画削除・part統合処理
   * （`strip-videos-and-consolidate-archives.ts`）で、Node.jsプロセスのメモリ枯渇を避けるために使う（Issue #99）
   * @param accessToken Google Driveのアクセストークン
   * @param fileId 対象のDriveファイルID
   * @param destPath ダウンロード先のファイルパス
   */
  async downloadFileToPath(accessToken: string, fileId: string, destPath: string): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<Readable>(`${GOOGLE_DRIVE_API_BASE_URL}/files/${fileId}`, {
          // biome-ignore lint/style/useNamingConvention: HTTPヘッダー名の正規表記(Authorization)に合わせる
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { alt: 'media' },
          responseType: 'stream',
          timeout: GOOGLE_DRIVE_STREAMING_TRANSFER_TIMEOUT_MS
        })
      );

      // 実際に書き込んだバイト数をContent-Lengthヘッダーと突き合わせて検証する。数GB〜十数GB規模の
      // ダウンロードで、末尾が欠落した状態のファイルなのにwriteStreamの'finish'（'error'ではなく）が
      // 発火し、ダウンロード成功として扱われてしまう不具合が実際に発生した（約9.3GiBの単一アーカイブ
      // で発生し、後段のzip読み込み処理が失敗するまで気づけなかった。Issue #99）。原因（タイムアウト・
      // ネットワーク切断等）を問わず、途中で打ち切られたダウンロードを確実に検出できるようにする
      let downloadedBytes = 0;
      response.data.on('data', (chunk: Buffer) => {
        downloadedBytes += chunk.length;
      });

      await new Promise<void>((resolve, reject) => {
        const writeStream = createWriteStream(destPath);
        response.data.on('error', reject);
        writeStream.on('error', reject);
        writeStream.on('finish', resolve);
        response.data.pipe(writeStream);
      });

      const expectedContentLength = response.headers?.['content-length'];
      if (expectedContentLength !== undefined && downloadedBytes !== Number(expectedContentLength)) {
        throw new Error(
          `ダウンロードしたファイルサイズが不整合です（期待値: ${expectedContentLength}バイト、実際: ${downloadedBytes}バイト）`
        );
      }
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
   * ディスク上のファイルを、内容全体をメモリへ読み込まずチャンク単位で逐次読み出しながら
   * レジューマブルアップロードする。`updateFileContent`（Bufferを丸ごと受け取る）と異なり、
   * 月合計サイズが数GB〜十数GBになりうる月別アーカイブzipの動画削除・part統合処理
   * （`strip-videos-and-consolidate-archives.ts`）で、Node.jsプロセスのメモリ枯渇を避けるために使う。
   * チャンクの読み出しには同一サイズのバッファを使い回すため、ファイル全体のサイズに関わらず
   * 常にチャンク1つ分のメモリ使用量で済む（Issue #99）
   * @param accessToken Google Driveのアクセストークン
   * @param fileId 更新対象のDriveファイルID
   * @param sourcePath アップロードするファイルのパス
   * @param chunkSizeBytes 1チャンクあたりのサイズ。テストで小さい値へ差し替えられるよう引数化しているが、
   * 通常は省略しデフォルト（`UPLOAD_CHUNK_SIZE_BYTES`）を使うこと
   */
  async uploadFileFromPath(
    accessToken: string,
    fileId: string,
    sourcePath: string,
    chunkSizeBytes: number = UPLOAD_CHUNK_SIZE_BYTES
  ): Promise<void> {
    const fileHandle = await open(sourcePath, 'r');
    try {
      const { size: totalSizeBytes } = await fileHandle.stat();

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
              'X-Upload-Content-Length': String(totalSizeBytes)
            },
            params: { uploadType: 'resumable' },
            timeout: GOOGLE_DRIVE_REQUEST_TIMEOUT_MS
          }
        )
      );

      const uploadSessionUrl: string = sessionResponse.headers.location;
      for (let start = 0; start < totalSizeBytes; start += chunkSizeBytes) {
        const end = Math.min(start + chunkSizeBytes, totalSizeBytes);
        // チャンクごとに新規Bufferを確保する。1本のBufferを使い回すと、そのビュー(subarray)を
        // 引数に渡した後続処理（テストのモック記録やリトライ処理等）が実行される時点で
        // 既に次のチャンクの内容へ上書きされてしまう恐れがあるため
        const chunkBuffer = Buffer.alloc(end - start);
        const { bytesRead } = await fileHandle.read(chunkBuffer, 0, end - start, start);
        await firstValueFrom(
          this.httpService.put(uploadSessionUrl, chunkBuffer.subarray(0, bytesRead), {
            headers: {
              'Content-Type': 'application/zip',
              'Content-Range': `bytes ${start}-${end - 1}/${totalSizeBytes}`
            },
            maxRedirects: 0,
            validateStatus: isValidUploadChunkStatus,
            timeout: UPLOAD_CHUNK_TIMEOUT_MS
          })
        );
      }
    } catch (error) {
      throw toGoogleDriveApiException(error);
    } finally {
      await fileHandle.close();
    }
  }

  /**
   * 指定したファイルを削除する
   * @param accessToken Google Driveのアクセストークン
   * @param fileId 削除対象のDriveファイルID
   */
  async deleteFile(accessToken: string, fileId: string): Promise<void> {
    try {
      await firstValueFrom(
        this.httpService.delete(`${GOOGLE_DRIVE_API_BASE_URL}/files/${fileId}`, {
          // biome-ignore lint/style/useNamingConvention: HTTPヘッダー名の正規表記(Authorization)に合わせる
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: GOOGLE_DRIVE_REQUEST_TIMEOUT_MS
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
