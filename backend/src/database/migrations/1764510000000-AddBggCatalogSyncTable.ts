import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBggCatalogSyncTable1764510000000 implements MigrationInterface {
  name = 'AddBggCatalogSyncTable1764510000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "bgg_catalog_sync" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "jobKey" character varying NOT NULL,
        "lastAttemptAt" TIMESTAMP WITH TIME ZONE,
        "lastAttemptStatus" character varying(32),
        "lastAttemptMessage" text,
        "lastSuccessAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_bgg_catalog_sync_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_bgg_catalog_sync_jobKey" UNIQUE ("jobKey")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "bgg_catalog_sync"`);
  }
}
