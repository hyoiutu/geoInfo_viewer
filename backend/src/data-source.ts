import 'dotenv/config';
import { DataSource } from 'typeorm';
import { createDataSourceOptions } from './database/database.config';

// biome-ignore lint/style/noDefaultExport: TypeORM CLI(`-d`オプション)がdefault exportされたDataSourceを要求するため
export default new DataSource(createDataSourceOptions(process.env));
