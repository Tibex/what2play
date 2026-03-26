import type { MigrationInterface, QueryRunner } from 'typeorm';

export class EventTimezoneAndSessionColumns1764300000000
  implements MigrationInterface
{
  name = 'EventTimezoneAndSessionColumns1764300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "events"
      ADD COLUMN IF NOT EXISTS "eventTimezone" character varying NOT NULL DEFAULT 'UTC'
    `);
    await queryRunner.query(`
      ALTER TABLE "events"
      ADD COLUMN IF NOT EXISTS "sessionStartedAt" timestamptz
    `);
    await queryRunner.query(`
      ALTER TABLE "events"
      ADD COLUMN IF NOT EXISTS "sessionEndedAt" timestamptz
    `);
    await queryRunner.query(`
      ALTER TABLE "events"
      ADD COLUMN IF NOT EXISTS "sessionTotalMinutes" integer
    `);
    await queryRunner.query(`
      ALTER TABLE "events"
      ADD COLUMN IF NOT EXISTS "sessionTimingSource" character varying
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events" DROP COLUMN IF EXISTS "sessionTimingSource"`,
    );
    await queryRunner.query(
      `ALTER TABLE "events" DROP COLUMN IF EXISTS "sessionTotalMinutes"`,
    );
    await queryRunner.query(
      `ALTER TABLE "events" DROP COLUMN IF EXISTS "sessionEndedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "events" DROP COLUMN IF EXISTS "sessionStartedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "events" DROP COLUMN IF EXISTS "eventTimezone"`,
    );
  }
}
