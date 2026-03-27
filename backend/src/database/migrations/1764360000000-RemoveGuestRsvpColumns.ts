import type { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveGuestRsvpColumns1764360000000 implements MigrationInterface {
  name = 'RemoveGuestRsvpColumns1764360000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "event_attendees"
      DROP COLUMN IF EXISTS "isGuest"
    `);
    await queryRunner.query(`
      ALTER TABLE "event_attendees"
      DROP COLUMN IF EXISTS "guestName"
    `);
    await queryRunner.query(`
      ALTER TABLE "event_votes"
      DROP COLUMN IF EXISTS "guestName"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "event_attendees"
      ADD COLUMN IF NOT EXISTS "isGuest" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "event_attendees"
      ADD COLUMN IF NOT EXISTS "guestName" character varying
    `);
    await queryRunner.query(`
      ALTER TABLE "event_votes"
      ADD COLUMN IF NOT EXISTS "guestName" character varying
    `);
  }
}
