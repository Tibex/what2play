import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AttendanceReliabilitySupport1764320000000
  implements MigrationInterface
{
  name = 'AttendanceReliabilitySupport1764320000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "events"
      ADD COLUMN IF NOT EXISTS "fallbackGameId" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "events"
      ADD COLUMN IF NOT EXISTS "autoPromoteWaitlist" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "events"
      ADD COLUMN IF NOT EXISTS "lastAttendanceChangeAt" timestamptz
    `);
    await queryRunner.query(`
      ALTER TABLE "events"
      ADD COLUMN IF NOT EXISTS "attendanceChangeAfterDecision" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "events"
      ADD COLUMN IF NOT EXISTS "lateCancellationCount" integer NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      ALTER TABLE "event_attendees"
      ADD COLUMN IF NOT EXISTS "cancellationReason" character varying
    `);
    await queryRunner.query(`
      ALTER TABLE "event_attendees"
      ADD COLUMN IF NOT EXISTS "waitlistPriority" integer
    `);
    await queryRunner.query(`
      ALTER TABLE "event_attendees"
      ADD COLUMN IF NOT EXISTS "lastStatusChangeAt" timestamptz
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "event_attendees" DROP COLUMN IF EXISTS "lastStatusChangeAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_attendees" DROP COLUMN IF EXISTS "waitlistPriority"`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_attendees" DROP COLUMN IF EXISTS "cancellationReason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "events" DROP COLUMN IF EXISTS "lateCancellationCount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "events" DROP COLUMN IF EXISTS "attendanceChangeAfterDecision"`,
    );
    await queryRunner.query(
      `ALTER TABLE "events" DROP COLUMN IF EXISTS "lastAttendanceChangeAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "events" DROP COLUMN IF EXISTS "autoPromoteWaitlist"`,
    );
    await queryRunner.query(
      `ALTER TABLE "events" DROP COLUMN IF EXISTS "fallbackGameId"`,
    );
  }
}
