import { CyclingActivityEntity } from '../activities/entities/cycling-activity.entity';
import { SyncStateEntity } from '../activities/entities/sync-state.entity';

const DEFAULT_DATABASE_PORT = 5432;
const POSTGRES_DATABASE_TYPE = 'postgres' as const;

/** createDataSourceOptionsの戻り値（TypeORMのDataSourceOptionsとして使う接続設定） */
type DataSourceOptions = {
  /** DBの種類（本プロジェクトでは常にpostgres） */
  type: typeof POSTGRES_DATABASE_TYPE;
  /** DBホスト名 */
  host: string | undefined;
  /** DBポート番号（未指定時はデフォルトの5432） */
  port: number;
  /** DB接続ユーザー名 */
  username: string | undefined;
  /** DB接続パスワード */
  password: string | undefined;
  /** 接続先DB名 */
  database: string | undefined;
  /** TypeORMに登録するEntity一覧 */
  entities: [typeof CyclingActivityEntity, typeof SyncStateEntity];
  /** マイグレーションファイルの探索パス */
  migrations: string[];
};

/**
 * 環境変数からTypeORMのDataSource接続設定を組み立てる
 * @param env 環境変数（`process.env`）
 * @returns DataSourceの接続設定
 */
export const createDataSourceOptions = (env: NodeJS.ProcessEnv): DataSourceOptions => ({
  type: POSTGRES_DATABASE_TYPE,
  host: env.DATABASE_HOST,
  port: env.DATABASE_PORT === undefined ? DEFAULT_DATABASE_PORT : Number(env.DATABASE_PORT),
  username: env.DATABASE_USERNAME,
  password: env.DATABASE_PASSWORD,
  database: env.DATABASE_NAME,
  entities: [CyclingActivityEntity, SyncStateEntity],
  migrations: ['dist/migrations/*.js']
});
