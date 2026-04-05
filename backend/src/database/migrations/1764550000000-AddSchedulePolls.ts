import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSchedulePolls1764550000000 implements MigrationInterface {
  name = 'AddSchedulePolls1764550000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "schedule_polls" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "hostId" uuid NOT NULL,
        "title" text,
        "timezone" character varying NOT NULL,
        "deadline" timestamptz,
        "status" character varying NOT NULL DEFAULT 'open',
        "winningSlotId" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_schedule_polls_host"
          FOREIGN KEY ("hostId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "schedule_poll_slots" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "pollId" uuid NOT NULL,
        "start" timestamptz NOT NULL,
        "label" text,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_schedule_poll_slots_poll"
          FOREIGN KEY ("pollId") REFERENCES "schedule_polls"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "schedule_poll_participants" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "pollId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_schedule_poll_participants_poll_user"
          UNIQUE ("pollId", "userId"),
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
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_schedule_poll_responses_slot_user"
          UNIQUE ("slotId", "userId"),
        CONSTRAINT "FK_schedule_poll_responses_poll"
          FOREIGN KEY ("pollId") REFERENCES "schedule_polls"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_schedule_poll_responses_slot"
          FOREIGN KEY ("slotId") REFERENCES "schedule_poll_slots"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_schedule_poll_responses_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_schedule_poll_slots_poll"
      ON "schedule_poll_slots" ("pollId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_schedule_poll_participants_poll"
      ON "schedule_poll_participants" ("pollId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_schedule_poll_responses_poll"
      ON "schedule_poll_responses" ("pollId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "schedule_poll_responses"`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "schedule_poll_participants"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "schedule_poll_slots"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "schedule_polls"`);
  }
}
