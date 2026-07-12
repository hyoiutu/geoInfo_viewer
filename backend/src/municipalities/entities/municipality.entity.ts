import type { MultiPolygon } from 'geojson';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

const MUNICIPALITIES_TABLE_NAME = 'municipalities';

/** 市区町村境界（都道府県名・市区町村名・境界ポリゴン）1件分 */
@Entity({ name: MUNICIPALITIES_TABLE_NAME })
export class MunicipalityEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'prefecture_name' })
  prefectureName!: string;

  @Column({ name: 'municipality_name' })
  municipalityName!: string;

  @Column({ type: 'geometry', spatialFeatureType: 'MultiPolygon', srid: 4326 })
  geom!: MultiPolygon;
}
