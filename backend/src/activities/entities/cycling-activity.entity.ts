import type { LineString } from 'geojson';
import { Column, Entity, PrimaryColumn } from 'typeorm';

const CYCLING_ACTIVITIES_TABLE_NAME = 'cycling_activities';

@Entity({ name: CYCLING_ACTIVITIES_TABLE_NAME })
export class CyclingActivityEntity {
  // StravaのアクティビティIDはPostgresのinteger(int4)の範囲を超えるためbigintで保持する。
  // IDに対して数値比較・演算を行うことは無い（存在確認・DBの主キーとしての利用のみ）ため、
  // pgドライバがbigintをそのまま返す文字列として扱い、number変換用のtransformerは持たない。
  @PrimaryColumn({ type: 'bigint' })
  id!: string;

  @Column()
  name!: string;

  @Column({ name: 'distance_meters', type: 'double precision' })
  distanceMeters!: number;

  @Column({ name: 'moving_time_seconds', type: 'integer' })
  movingTimeSeconds!: number;

  @Column({ name: 'start_date', type: 'timestamptz' })
  startDate!: Date;

  @Column({ type: 'geometry', spatialFeatureType: 'LineString', srid: 4326, nullable: true })
  path!: LineString | null;

  // 詳細API(GET /activities/{id})での取得が完了した時刻。nullの間は初期取り込み未完了（プレースホルダー）を表す。
  // pathがnullでもこの値が入っていれば「GPSルートの無いアクティビティとして取得済み」と判別できる。
  @Column({ name: 'detail_fetched_at', type: 'timestamptz', nullable: true })
  detailFetchedAt!: Date | null;
}
