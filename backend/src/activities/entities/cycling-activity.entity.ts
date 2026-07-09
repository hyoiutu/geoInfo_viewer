import type { LineString } from 'geojson';
import { Column, Entity, PrimaryColumn } from 'typeorm';

const CYCLING_ACTIVITIES_TABLE_NAME = 'cycling_activities';

// StravaのアクティビティIDはPostgresのinteger(int4)の範囲を超えるためbigintで保持する。
// pgドライバはbigintを文字列で返すため、JSのnumberとして扱えるようtransformerで相互変換する
// (Strava側のID桁数は現状Number.MAX_SAFE_INTEGERを超えないため、この変換による精度欠損は発生しない)。
const bigintNumberTransformer = {
  to: (value: number) => value,
  from: (value: string) => Number(value)
};

@Entity({ name: CYCLING_ACTIVITIES_TABLE_NAME })
export class CyclingActivityEntity {
  @PrimaryColumn({ type: 'bigint', transformer: bigintNumberTransformer })
  id!: number;

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
