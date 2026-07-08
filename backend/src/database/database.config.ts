import { CyclingActivityEntity } from '../activities/entities/cycling-activity.entity';
import { SyncStateEntity } from '../activities/entities/sync-state.entity';

const DEFAULT_DATABASE_PORT = 5432;
const POSTGRES_DATABASE_TYPE = 'postgres' as const;

export const createDataSourceOptions = (env: NodeJS.ProcessEnv) => ({
  type: POSTGRES_DATABASE_TYPE,
  host: env.DATABASE_HOST,
  port: env.DATABASE_PORT === undefined ? DEFAULT_DATABASE_PORT : Number(env.DATABASE_PORT),
  username: env.DATABASE_USERNAME,
  password: env.DATABASE_PASSWORD,
  database: env.DATABASE_NAME,
  entities: [CyclingActivityEntity, SyncStateEntity],
  migrations: ['dist/migrations/*.js']
});
