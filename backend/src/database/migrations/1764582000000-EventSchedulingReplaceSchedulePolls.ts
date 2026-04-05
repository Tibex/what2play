import type { MigrationInterface, QueryRunner } from 'typeorm';

export class EventSchedulingReplaceSchedulePolls1764582000000
  implements MigrationInterface
{
  name = 'EventSchedulingReplaceSchedulePolls1764582000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "schedule_poll_invites"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "schedule_poll_responses"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "schedule_poll_participants"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "schedule_poll_slots"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "schedule_polls"`);

    await queryRunner.query(
      `ALTER TABLE "events" ALTER COLUMN "dateTime" DROP NOT NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE "event_schedule_slots" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "eventId" uuid NOT NULL,
        "start" TIMESTAMPTZ NOT NULL,
        "label" text,
        "sortOrder" integer NOT NULL DEFAULT 0,
        CONSTRAINT "FK_event_schedule_slots_event"
          FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_event_schedule_slots_event" ON "event_schedule_slots" ("eventId")`,
    );

    await queryRunner.query(`
      CREATE TABLE "event_schedule_responses" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "eventId" uuid NOT NULL,
        "slotId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "answer" character varying NOT NULL,
        CONSTRAINT "UQ_event_schedule_responses_slot_user" UNIQUE ("slotId", "userId"),
        CONSTRAINT "FK_event_schedule_responses_event"
          FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_event_schedule_responses_slot"
          FOREIGN KEY ("slotId") REFERENCES "event_schedule_slots"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_event_schedule_responses_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_event_schedule_responses_event" ON "event_schedule_responses" ("eventId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "event_schedule_responses"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "event_schedule_slots"`);

    await queryRunner.query(
      `DELETE FROM "events" WHERE "dateTime" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "events" ALTER COLUMN "dateTime" SET NOT NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "schedule_polls" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "hostId" uuid NOT NULL,
        "title" character varying,
        "timezone" character varying NOT NULL DEFAULT 'UTC',
        "deadline" TIMESTAMPTZ,
        "status" character varying NOT NULL DEFAULT 'open',
        "winningSlotId" uuid,
        "durationMinutes" integer,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_schedule_polls_host"
          FOREIGN KEY ("hostId") REFERENCES "users"("id") ON DELETE NO ACTION
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "schedule_poll_slots" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "pollId" uuid NOT NULL,
        "start" TIMESTAMPTZ NOT NULL,
        "label" text,
        "sortOrder" integer NOT NULL DEFAULT 0,
        CONSTRAINT "FK_schedule_poll_slots_poll"
          FOREIGN KEY ("pollId") REFERENCES "schedule_polls"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "schedule_poll_participants" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "pollId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        CONSTRAINT "UQ_schedule_poll_participants_poll_user" UNIQUE ("pollId", "userId"),
        CONSTRAINT "FK_schedule_poll_participants_poll"
          FOREIGN KEY ("pollId") REFERENCES "schedule_polls"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_schedule_poll_participants_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "schedule_poll_responses" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "pollId" uuid NOT NULL,
        "slotId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "answer" character varying NOT NULL,
        CONSTRAINT "UQ_schedule_poll_responses_slot_user" UNIQUE ("slotId", "userId"),
        CONSTRAINT "FK_schedule_poll_responses_poll"
          FOREIGN KEY ("pollId") REFERENCES "schedule_polls"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_schedule_poll_responses_slot"
          FOREIGN KEY ("slotId") REFERENCES "schedule_poll_slots"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_schedule_poll_responses_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "schedule_poll_invites" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "pollId" uuid NOT NULL,
        "token" character varying NOT NULL,
        CONSTRAINT "UQ_schedule_poll_invites_token" UNIQUE ("token"),
        CONSTRAINT "FK_schedule_poll_invites_poll"
          FOREIGN KEY ("pollId") REFERENCES "schedule_polls"("id") ON DELETE CASCADE
      )
    `);
  }
}
