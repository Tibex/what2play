import 'dotenv/config';
import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { createDataSourceOptions } from './typeorm.config';

const config = new ConfigService(process.env);

export default new DataSource(createDataSourceOptions(config));
