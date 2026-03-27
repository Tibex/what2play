import type { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveSessionTimerArtifacts1764390000000 implements MigrationInterface {
  name = 'RemoveSessionTimerArtifacts1764390000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "events" DROP COLUMN IF EXISTS "sessionTimingSource"
    `);
    await queryRunner.query(`
      ALTER TABLE "events" DROP COLUMN IF EXISTS "sessionTotalMinutes"
    `);
    await queryRunner.query(`
      ALTER TABLE "events" DROP COLUMN IF EXISTS "sessionEndedAt"
    `);
    await queryRunner.query(`
      ALTER TABLE "events" DROP COLUMN IF EXISTS "sessionStartedAt"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "session_timings"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "session_timings" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "eventId" uuid NOT NULL,
        "gameId" uuid NOT NULL,
        "playerCount" integer NOT NULL,
        "setupMinutes" integer,
        "gameplayMinutes" integer,
        "totalMinutes" integer,
        "completed" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_session_timings_event" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_session_timings_game" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "sessionStartedAt" timestamptz
    `);
    await queryRunner.query(`
      ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "sessionEndedAt" timestamptz
    `);
    await queryRunner.query(`
      ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "sessionTotalMinutes" integer
    `);
    await queryRunner.query(`
      ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "sessionTimingSource" character varying
    `);
  }
}
