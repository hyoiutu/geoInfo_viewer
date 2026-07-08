import { Column, Entity, PrimaryColumn } from 'typeorm';

const SYNC_STATE_TABLE_NAME = 'sync_state';

// 単一ユーザー前提のため、行は常に1行(SYNC_STATE_SINGLETON_ID)のみ存在する
export const SYNC_STATE_SINGLETON_ID = 'singleton';

@Entity({ name: SYNC_STATE_TABLE_NAME })
export class SyncStateEntity {
  @PrimaryColumn()
  id!: string;

  @Column({ name: 'last_synced_at', type: 'timestamptz', nullable: true })
  lastSyncedAt!: Date | null;
}
