import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { createDataSourceOptions } from './typeorm.config';

function resolveEnvFiles(): string[] {
  const candidates = [
    join(process.cwd(), '.env.local'),
    join(process.cwd(), '.env'),
    join(__dirname, '..', '..', '.env.local'),
    join(__dirname, '..', '..', '.env'),
  ];
  const seen = new Set<string>();
  const existing: string[] = [];
  for (const file of candidates) {
    if (seen.has(file)) continue;
    seen.add(file);
    if (existsSync(file)) existing.push(file);
  }
  return existing.length ? existing : ['.env.local', '.env'];
}

for (const envFile of resolveEnvFiles()) {
  loadEnv({ path: envFile });
}

const config = new ConfigService(process.env);

export default new DataSource(createDataSourceOptions(config));
