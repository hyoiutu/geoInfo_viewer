import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import AdmZip from 'adm-zip';
import { Between, type Repository } from 'typeorm';
import { CyclingActivityEntity } from '../activities/entities/cycling-activity.entity';
import { GoogleDriveApiClient } from '../google-drive/google-drive-api.client';
import { GoogleDriveAuthService } from '../google-drive/google-drive-auth.service';
import { MonthlyPhotoThumbnailArchiveEntity } from './entities/monthly-photo-thumbnail-archive.entity';
import { PhotoEntity } from './entities/photo.entity';
import { toYearMonth } from './group-photos-by-year-month.util';
import { resolveImageContentType } from './image-content-type.util';
import { toPhotoDto } from './photo-dto.util';
import type { PhotoDto } from './types/photo.dto';

const MILLISECONDS_PER_SECOND = 1000;
// 月別アーカイブzipをメモリへキャッシュしておく上限件数。アクティビティ1件分の写真は
// 同じ（または近接する）撮影年月に集中することが多く、写真ごとに同じzipを毎回再ダウンロードすると
// 無駄が大きいため、直近アクセスしたアーカイブを少数だけ保持する（Issue #23フォローアップ）
const MAX_CACHED_ARCHIVES = 5;

/** findImageByPhotoIdの戻り値（写真1件分のバイナリ本体とContent-Type） */
export type PhotoImage = {
  /** 写真のバイナリ本体 */
  data: Buffer;
  /** HTTPレスポンス用のContent-Type */
  contentType: string;
};

/**
 * アクティビティの開始・終了日時をもとに、その期間に撮影された写真を検索するサービス。
 * 写真の実バイナリは、表示のために必要になったものだけをGoogle Drive上の月別アーカイブzipから
 * 遅延取得する（`photos`テーブルにはメタデータのみを保持、Issue #23）
 */
@Injectable()
export class PhotosService {
  // 月別アーカイブzipのダウンロード結果をsourceFileId単位でキャッシュする。
  // Mapは挿入順を保持するため、参照時に再挿入することで簡易LRUとして使う
  private readonly archiveZipCache = new Map<string, Buffer>();

  constructor(
    @InjectRepository(CyclingActivityEntity)
    private readonly cyclingActivityRepository: Repository<CyclingActivityEntity>,
    @InjectRepository(PhotoEntity)
    private readonly photoRepository: Repository<PhotoEntity>,
    @InjectRepository(MonthlyPhotoThumbnailArchiveEntity)
    private readonly thumbnailArchiveRepository: Repository<MonthlyPhotoThumbnailArchiveEntity>,
    private readonly googleDriveAuthService: GoogleDriveAuthService,
    private readonly googleDriveApiClient: GoogleDriveApiClient
  ) {}

  /**
   * 指定したアクティビティの開始日時〜終了日時（開始日時+経過時間）の範囲で撮影された写真を、
   * 撮影日時の昇順で返す。位置情報を持たない写真もそのまま含める（location: null、Issue #23）
   * @param activityId 対象のアクティビティID
   * @returns 期間内に撮影された写真一覧（撮影日時昇順）。アクティビティが存在しない場合は空配列
   */
  async findByActivity(activityId: string): Promise<PhotoDto[]> {
    const activity = await this.cyclingActivityRepository.findOneBy({ id: activityId });
    if (activity === null) {
      return [];
    }

    const endDate = new Date(activity.startDate.getTime() + activity.elapsedTimeSeconds * MILLISECONDS_PER_SECOND);

    const photos = await this.photoRepository.find({
      where: { takenAt: Between(activity.startDate, endDate) },
      order: { takenAt: 'ASC' }
    });
    return photos.map((photo) => toPhotoDto(photo));
  }

  /**
   * 指定した写真IDのバイナリ本体を、Google Drive上の月別アーカイブzip（`sourceFileId`）から
   * 該当エントリ（`archivePath`）を取り出して返す
   * @param photoId 対象の写真ID
   * @returns 写真のバイナリ本体とContent-Type。写真自体、またはzip内の対応エントリが存在しない場合はnull
   */
  async findImageByPhotoId(photoId: number): Promise<PhotoImage | null> {
    const photo = await this.findPhotoOrNull(photoId);
    if (photo === null) {
      return null;
    }

    const zipBuffer = await this.getOrFetchArchiveZip(photo.sourceFileId);
    return this.extractImageFromZip(zipBuffer, photo.archivePath, photo.fileName);
  }

  /**
   * 指定した写真IDのサムネイル画像を、Google Drive上のサムネイル専用月別アーカイブzip
   * （`monthly_photo_thumbnail_archives`）から該当エントリ（`archivePath`）を取り出して返す。
   * 撮影年月に対応するサムネイルアーカイブが存在しない（未処理・失敗年月）場合、サムネイルzip内に
   * 対応するエントリが見つからない（生成失敗等）場合はいずれもnullを返す。フロントエンド側は
   * nullに対応するHTTP 404を受けてフルサイズ画像（`findImageByPhotoId`）へフォールバックする（Issue #105）
   * @param photoId 対象の写真ID
   * @returns サムネイルのバイナリ本体とContent-Type。取得できない場合はnull
   */
  async findThumbnailByPhotoId(photoId: number): Promise<PhotoImage | null> {
    const photo = await this.findPhotoOrNull(photoId);
    if (photo === null) {
      return null;
    }

    const thumbnailArchive = await this.thumbnailArchiveRepository.findOneBy({
      yearMonth: toYearMonth(photo.takenAt)
    });
    if (thumbnailArchive === null) {
      return null;
    }

    const zipBuffer = await this.getOrFetchArchiveZip(thumbnailArchive.driveFileId);
    return this.extractImageFromZip(zipBuffer, photo.archivePath, photo.fileName);
  }

  /**
   * 写真IDから`PhotoEntity`を取得する。フルサイズ・サムネイルいずれの取得メソッドも、
   * 対象写真の存在確認（`id`によるlookup、存在しなければnull）というロジック自体は同一のため、
   * `findImageByPhotoId`・`findThumbnailByPhotoId`の両方から使う（PR #115レビュー対応）
   * @param photoId 対象の写真ID
   * @returns 対応する写真のEntity。存在しない場合はnull
   */
  private async findPhotoOrNull(photoId: number): Promise<PhotoEntity | null> {
    return this.photoRepository.findOneBy({ id: photoId });
  }

  /**
   * zip本体から指定したエントリパスの画像を取り出す。フルサイズ・サムネイルいずれのアーカイブzipに
   * 対しても、エントリパスの解決方法（`sourceFileId`経由かサムネイル専用テーブル経由か）が
   * 異なるだけでzip内からの取り出し自体は共通のため、`findImageByPhotoId`・`findThumbnailByPhotoId`
   * の両方から使う（Issue #105）
   * @param zipBuffer 取り出し元のzip本体
   * @param archivePath zip内でのエントリパス
   * @param fileName Content-Type判定用のファイル名
   * @returns 取り出した画像のバイナリ本体とContent-Type。対応するエントリが無い場合はnull
   */
  private extractImageFromZip(zipBuffer: Buffer, archivePath: string, fileName: string): PhotoImage | null {
    const entry = new AdmZip(zipBuffer).getEntry(archivePath);
    if (entry === null) {
      return null;
    }
    return { data: entry.getData(), contentType: resolveImageContentType(fileName) };
  }

  /**
   * 月別アーカイブzip（sourceFileId指定）を取得する。キャッシュ済みであればそれを使い、
   * 無ければGoogle Driveからダウンロードしてキャッシュへ保存する
   * @param sourceFileId 取得対象の月別アーカイブzipのGoogle DriveファイルID
   * @returns zip本体
   */
  private async getOrFetchArchiveZip(sourceFileId: string): Promise<Buffer> {
    const cached = this.archiveZipCache.get(sourceFileId);
    if (cached) {
      // 参照時に一度削除して再挿入し、挿入順を最新化する（簡易LRU）
      this.archiveZipCache.delete(sourceFileId);
      this.archiveZipCache.set(sourceFileId, cached);
      return cached;
    }

    const accessToken = await this.googleDriveAuthService.getAccessToken();
    const zipBuffer = await this.googleDriveApiClient.downloadFile(accessToken, sourceFileId);

    this.archiveZipCache.set(sourceFileId, zipBuffer);
    if (this.archiveZipCache.size > MAX_CACHED_ARCHIVES) {
      const oldestKey = this.archiveZipCache.keys().next().value;
      if (oldestKey !== undefined) {
        this.archiveZipCache.delete(oldestKey);
      }
    }
    return zipBuffer;
  }
}
