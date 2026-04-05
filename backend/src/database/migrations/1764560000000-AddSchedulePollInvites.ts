import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSchedulePollInvites1764560000000 implements MigrationInterface {
  name = 'AddSchedulePollInvites1764560000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "schedule_poll_invites" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "pollId" uuid NOT NULL,
        "token" character varying NOT NULL,
        "email" character varying,
        "used" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_schedule_poll_invites_token" UNIQUE ("token"),
        CONSTRAINT "FK_schedule_poll_invites_poll"
          FOREIGN KEY ("pollId") REFERENCES "schedule_polls"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_schedule_poll_invites_poll"
      ON "schedule_poll_invites" ("pollId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "schedule_poll_invites"`);
  }
}
