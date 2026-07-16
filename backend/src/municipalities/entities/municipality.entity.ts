import type { MultiPolygon } from 'geojson';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

const MUNICIPALITIES_TABLE_NAME = 'municipalities';

/** 市区町村境界（都道府県名・市区町村名・境界ポリゴン・年代）1件分 */
@Entity({ name: MUNICIPALITIES_TABLE_NAME })
export class MunicipalityEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  // 現行の行政区画は'current'、過去の行政区画はgeoshape.ex.nii.ac.jpの基準日をそのまま使う
  // （例: '2000-10-01'）。同一テーブルに複数年代分を格納し、年代ごとに絞り込んで参照する（Issue #34）
  @Column()
  era!: string;

  @Column({ name: 'prefecture_name' })
  prefectureName!: string;

  @Column({ name: 'municipality_name' })
  municipalityName!: string;

  @Column({ type: 'geometry', spatialFeatureType: 'MultiPolygon', srid: 4326 })
  geom!: MultiPolygon;
}
