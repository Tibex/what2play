import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCalendarSyncSupport1764500000000 implements MigrationInterface {
  name = 'AddCalendarSyncSupport1764500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sync_accounts"
      ALTER COLUMN "externalUsername" DROP NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "sync_accounts"
      ADD COLUMN IF NOT EXISTS "externalAccountId" character varying
    `);
    await queryRunner.query(`
      ALTER TABLE "sync_accounts"
      ADD COLUMN IF NOT EXISTS "encryptedAccessToken" text
    `);
    await queryRunner.query(`
      ALTER TABLE "sync_accounts"
      ADD COLUMN IF NOT EXISTS "encryptedRefreshToken" text
    `);
    await queryRunner.query(`
      ALTER TABLE "sync_accounts"
      ADD COLUMN IF NOT EXISTS "scopes" text
    `);
    await queryRunner.query(`
      ALTER TABLE "sync_accounts"
      ADD COLUMN IF NOT EXISTS "tokenExpiresAt" TIMESTAMPTZ
    `);
    await queryRunner.query(`
      ALTER TABLE "sync_accounts"
      ADD COLUMN IF NOT EXISTS "syncCursor" text
    `);
    await queryRunner.query(`
      ALTER TABLE "sync_accounts"
      ADD COLUMN IF NOT EXISTS "lastError" text
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "event_calendar_sync" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "eventId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "provider" character varying NOT NULL,
        "calendarId" character varying,
        "remoteEventId" character varying,
        "remoteEtag" character varying,
        "lastOutboundHash" character varying,
        "syncState" character varying NOT NULL DEFAULT 'pending',
        "lastError" text,
        "direction" character varying NOT NULL DEFAULT 'outbound',
        "lastSyncedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_event_calendar_sync_event" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_event_calendar_sync_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_event_calendar_sync_event_user_provider" UNIQUE ("eventId", "userId", "provider")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_event_calendar_sync_user_provider"
      ON "event_calendar_sync" ("userId", "provider")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "calendar_change_log" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "provider" character varying NOT NULL,
        "externalChangeId" character varying NOT NULL,
        "eventId" uuid,
        "userId" uuid,
        "payload" text,
        "status" character varying NOT NULL DEFAULT 'received',
        "error" text,
        "processedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_calendar_change_log_provider_external" UNIQUE ("provider", "externalChangeId")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "calendar_change_log"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "event_calendar_sync"`);

    await queryRunner.query(`
      ALTER TABLE "sync_accounts"
      DROP COLUMN IF EXISTS "lastError"
    `);
    await queryRunner.query(`
      ALTER TABLE "sync_accounts"
      DROP COLUMN IF EXISTS "syncCursor"
    `);
    await queryRunner.query(`
      ALTER TABLE "sync_accounts"
      DROP COLUMN IF EXISTS "tokenExpiresAt"
    `);
    await queryRunner.query(`
      ALTER TABLE "sync_accounts"
      DROP COLUMN IF EXISTS "scopes"
    `);
    await queryRunner.query(`
      ALTER TABLE "sync_accounts"
      DROP COLUMN IF EXISTS "encryptedRefreshToken"
    `);
    await queryRunner.query(`
      ALTER TABLE "sync_accounts"
      DROP COLUMN IF EXISTS "encryptedAccessToken"
    `);
    await queryRunner.query(`
      ALTER TABLE "sync_accounts"
      DROP COLUMN IF EXISTS "externalAccountId"
    `);

    await queryRunner.query(`
      ALTER TABLE "sync_accounts"
      ALTER COLUMN "externalUsername" SET NOT NULL
    `);
  }
}
