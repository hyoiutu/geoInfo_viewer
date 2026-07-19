import { Injectable } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import type { FeatureCollection } from 'geojson';
import type { Repository } from 'typeorm';
import { MunicipalityEntity } from './entities/municipality.entity';
import { MUNICIPALITY_ERA_CURRENT, type MunicipalityEra } from './era.constants';

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
   * 含まれる自治体をPostGISの空間検索で求め、通過した順（同じ自治体を複数回通過した場合は最初に通過した順）で返す。
   * 軌跡が海外にある区間はどの自治体にも一致しないため、自動的に結果から除外される。
   * 軌跡を持たないアクティビティの場合は空配列を返す
   * @param activityId 対象のアクティビティID
   * @param era 判定に使う行政区画の年代識別子（省略時は現行）
   * @returns 通過した自治体一覧（通過順）
   */
  async findPassedMunicipalities(
    activityId: string,
    era: MunicipalityEra = MUNICIPALITY_ERA_CURRENT
  ): Promise<PassedMunicipalityDto[]> {
    return this.municipalityRepository.query(
      `
        SELECT "prefectureName", "municipalityName"
        FROM (
          SELECT DISTINCT ON (m.prefecture_name, m.municipality_name)
            m.prefecture_name AS "prefectureName",
            m.municipality_name AS "municipalityName",
            sampled_points.point_order AS point_order
          FROM (
            SELECT
              (dp).path AS point_order,
              (dp).geom AS pt
            FROM (
              SELECT ST_DumpPoints(
                ST_Segmentize(ca.path::geography, $2)::geometry
              ) AS dp
              FROM cycling_activities ca
              WHERE ca.id = $1 AND ca.path IS NOT NULL
            ) AS dumped
          ) AS sampled_points
          JOIN municipalities m ON ST_Contains(m.geom, sampled_points.pt) AND m.era = $3
          ORDER BY m.prefecture_name, m.municipality_name, sampled_points.point_order
        ) AS first_pass
        ORDER BY point_order
      `,
      [activityId, SEGMENTIZE_INTERVAL_METERS, era]
    );
  }

  /**
   * 指定した年代の市区町村境界を、地図描画用のGeoJSON FeatureCollectionとして返す
   * @param era 取得対象の年代識別子
   * @returns 境界ポリゴンのFeatureCollection（プロパティは都道府県名・市区町村名）
   */
  async findBoundariesByEra(era: MunicipalityEra): Promise<FeatureCollection> {
    const municipalities = await this.municipalityRepository.find({ where: { era } });

    return {
      type: 'FeatureCollection',
      features: municipalities.map((municipality) => ({
        type: 'Feature',
        geometry: municipality.geom,
        properties: {
          prefectureName: municipality.prefectureName,
          municipalityName: municipality.municipalityName
        }
      }))
    };
  }
}
