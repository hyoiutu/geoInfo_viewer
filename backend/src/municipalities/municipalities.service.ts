import { Injectable } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { MunicipalityEntity } from './entities/municipality.entity';

// アクティビティの軌跡から約100m間隔で点をサンプリングし、それぞれの点が含まれる自治体を判定する。
// 全Pointに対して逆ジオコーディングすると負荷が高いため、間隔を空けてサンプリングする（Issue #18の指定通り）
const SEGMENTIZE_INTERVAL_METERS = 100;

/** findPassedMunicipalitiesの戻り値1件分（通過した自治体） */
export class PassedMunicipalityDto {
  /** 都道府県名 */
  @ApiProperty({ description: '都道府県名' })
  prefectureName!: string;

  /** 市区町村名（政令指定都市の区の場合は市名を含む。例: 横浜市中区） */
  @ApiProperty({ description: '市区町村名（政令指定都市の区の場合は市名を含む。例: 横浜市中区）' })
  municipalityName!: string;
}

/** アクティビティの軌跡（GPSトラック）から通過した自治体を求める逆ジオコーディングサービス */
@Injectable()
export class MunicipalitiesService {
  constructor(
    @InjectRepository(MunicipalityEntity)
    private readonly municipalityRepository: Repository<MunicipalityEntity>
  ) {}

  /**
   * 指定したアクティビティの軌跡上を約100m間隔でサンプリングした点それぞれについて、
   * 含まれる自治体をPostGISの空間検索で求め、重複を除いて返す。
   * 軌跡が海外にある区間はどの自治体にも一致しないため、自動的に結果から除外される。
   * 軌跡を持たないアクティビティの場合は空配列を返す
   * @param activityId 対象のアクティビティID
   * @returns 通過した自治体一覧（都道府県名・市区町村名順）
   */
  async findPassedMunicipalities(activityId: string): Promise<PassedMunicipalityDto[]> {
    return this.municipalityRepository.query(
      `
        SELECT DISTINCT m.prefecture_name AS "prefectureName", m.municipality_name AS "municipalityName"
        FROM (
          SELECT (ST_DumpPoints(
            ST_Segmentize(ca.path::geography, $2)::geometry
          )).geom AS pt
          FROM cycling_activities ca
          WHERE ca.id = $1 AND ca.path IS NOT NULL
        ) AS sampled_points
        JOIN municipalities m ON ST_Contains(m.geom, sampled_points.pt)
        ORDER BY 1, 2
      `,
      [activityId, SEGMENTIZE_INTERVAL_METERS]
    );
  }
}
