import { ConfigService } from '@nestjs/config';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import type { DataSourceOptions } from 'typeorm';

function resolveSsl(config: ConfigService, databaseUrl?: string) {
  if (!databaseUrl) return config.get('DATABASE_SSL') === 'true';
  const url = new URL(databaseUrl);
  const sslMode = url.searchParams.get('sslmode');
  return sslMode === 'require' || config.get('DATABASE_SSL') === 'true';
}

function resolveCoreOptions(config: ConfigService): DataSourceOptions {
  const databaseUrl = config.get<string>('DATABASE_URL');
  const useSsl = resolveSsl(config, databaseUrl);

  if (databaseUrl) {
    const url = new URL(databaseUrl);
    return {
      type: 'postgres',
      host: url.hostname,
      port: Number(url.port || 5432),
      username: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace(/^\//, ''),
      ssl: useSsl ? { rejectUnauthorized: false } : false,
    };
  }

  return {
    type: 'postgres',
    host: config.getOrThrow<string>('DATABASE_HOST'),
    port: Number(config.getOrThrow<string>('DATABASE_PORT')),
    username: config.getOrThrow<string>('DATABASE_USER'),
    password: config.getOrThrow<string>('DATABASE_PASSWORD'),
    database: config.getOrThrow<string>('DATABASE_NAME'),
    ssl: useSsl ? { rejectUnauthorized: false } : false,
  };
}

function resolveRuntimePaths() {
  const isTsRuntime =
    process.env.TS_NODE === 'true' ||
    process.env.NODE_ENV !== 'production' ||
    __filename.endsWith('.ts');

  if (isTsRuntime) {
    return {
      entities: ['src/**/*.entity.ts'],
      migrations: ['src/database/migrations/*.ts'],
    };
  }

  return {
    entities: ['dist/**/*.entity.js'],
    migrations: ['dist/database/migrations/*.js'],
  };
}

export function createTypeOrmOptions(
  config: ConfigService,
): TypeOrmModuleOptions {
  const paths = resolveRuntimePaths();
  return {
    ...resolveCoreOptions(config),
    autoLoadEntities: true,
    synchronize: config.get('DB_SYNCHRONIZE') === 'true',
    migrationsRun: config.get('DB_MIGRATIONS_RUN') !== 'false',
    migrations: paths.migrations,
  };
}

export function createDataSourceOptions(
  config: ConfigService,
): DataSourceOptions {
  const paths = resolveRuntimePaths();
  return {
    ...resolveCoreOptions(config),
    entities: paths.entities,
    migrations: paths.migrations,
  };
}
