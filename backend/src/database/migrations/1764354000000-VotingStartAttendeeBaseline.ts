import type { MigrationInterface, QueryRunner } from 'typeorm';

export class VotingStartAttendeeBaseline1764354000000 implements MigrationInterface {
  name = 'VotingStartAttendeeBaseline1764354000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "events"
      ADD COLUMN IF NOT EXISTS "votingStartedAttendeeCount" integer
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "events"
      DROP COLUMN IF EXISTS "votingStartedAttendeeCount"
    `);
  }
}
