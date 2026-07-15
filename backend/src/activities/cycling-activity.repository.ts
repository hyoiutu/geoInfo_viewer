import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, type Repository } from 'typeorm';
import type { StravaActivity } from '../strava/types/strava-activity.type';
import { toPlaceholderCyclingActivityEntity } from './cycling-activity-entity.util';
import { CyclingActivityEntity } from './entities/cycling-activity.entity';

const NO_ACTIVITIES = 0;

/**
 * CyclingActivityEntityへのDBアクセスを一本化するリポジトリ。
 * ActivitiesService・ActivitiesBackfillServiceの両方が同じEntityへの保存・重複チェックを
 * 別々に実装していたため、共通処理をここへ集約する（Issue #50）
 */
@Injectable()
export class CyclingActivityRepository {
  constructor(
    @InjectRepository(CyclingActivityEntity)
    private readonly repository: Repository<CyclingActivityEntity>
  ) {}

  /** @returns DBに保存済みの全アクティビティ */
  async findAll(): Promise<CyclingActivityEntity[]> {
    return this.repository.find();
  }

  /** @returns 詳細未取得（detailFetchedAtがnull）のアクティビティ */
  async findPendingDetail(): Promise<CyclingActivityEntity[]> {
    return this.repository.find({ where: { detailFetchedAt: IsNull() } });
  }

  /**
   * 詳細取得済みのEntity1件を保存する
   * @param entity 保存するEntity
   */
  async saveDetail(entity: CyclingActivityEntity): Promise<void> {
    await this.repository.save(entity);
  }

  /**
   * 詳細取得済みのEntityを複数件まとめて保存する。空配列の場合は何もしない
   * @param entities 保存するEntity配列
   */
  async saveDetails(entities: CyclingActivityEntity[]): Promise<void> {
    if (entities.length === NO_ACTIVITIES) {
      return;
    }
    await this.repository.save(entities);
  }

  /**
   * Stravaアクティビティ一覧のうち、DB未登録のものだけをプレースホルダーとして保存する（重複チェック）
   * @param activities Strava一覧APIのレスポンス
   */
  async savePlaceholdersIfNotExists(activities: StravaActivity[]): Promise<void> {
    const existingIds = new Set((await this.repository.find()).map((entity) => entity.id));
    const newPlaceholders = activities
      .filter((activity) => !existingIds.has(String(activity.id)))
      .map((activity) => toPlaceholderCyclingActivityEntity(activity));

    if (newPlaceholders.length > NO_ACTIVITIES) {
      await this.repository.save(newPlaceholders);
    }
  }

  /** 全アクティビティのdetailFetchedAtをnullへ一括リセットする */
  async resetAllDetailFetchedAt(): Promise<void> {
    await this.repository.createQueryBuilder().update(CyclingActivityEntity).set({ detailFetchedAt: null }).execute();
  }

  /** @returns DBに存在するアクティビティの総数 */
  async countAll(): Promise<number> {
    return this.repository.count();
  }

  /** @returns 詳細未取得（detailFetchedAtがnull）の件数 */
  async countPendingDetail(): Promise<number> {
    return this.repository.count({ where: { detailFetchedAt: IsNull() } });
  }

  /** @returns 詳細取得済み（detailFetchedAtがnullでない）の件数 */
  async countCompletedDetail(): Promise<number> {
    return this.repository.count({ where: { detailFetchedAt: Not(IsNull()) } });
  }
}
