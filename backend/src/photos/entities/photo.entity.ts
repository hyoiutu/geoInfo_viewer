import type { Point } from 'geojson';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

const PHOTOS_TABLE_NAME = 'photos';

/**
 * Google Takeoutから取り込んだ写真1件分のメタデータ。写真の実バイナリ自体は保存せず、
 * 撮影日時・位置情報と、取り込み元（Google DriveのzipファイルID・zip内のパス）のみを保持する。
 * 実バイナリは表示機能実装時に、この情報を使って必要になった写真だけ遅延取得する想定（Issue #23）
 */
@Entity({ name: PHOTOS_TABLE_NAME })
export class PhotoEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'file_name' })
  fileName!: string;

  @Column({ name: 'taken_at', type: 'timestamptz' })
  takenAt!: Date;

  // Google Takeoutのメタデータで位置情報が無い写真はlatitude/longitudeが0.0扱いになるため、
  // その場合はnullとして保存する（takeout-metadata.utilで判定済みの値を受け取る）
  @Column({ type: 'geometry', spatialFeatureType: 'Point', srid: 4326, nullable: true })
  location!: Point | null;

  // 取り込み元のGoogle Drive上のzip（Takeoutエクスポート本体）のfileId
  @Column({ name: 'source_file_id' })
  sourceFileId!: string;

  // zip内でのエントリパス。実バイナリを遅延取得する際、このzipを再ダウンロードしこのパスのエントリを取り出す
  @Column({ name: 'archive_path' })
  archivePath!: string;
}
