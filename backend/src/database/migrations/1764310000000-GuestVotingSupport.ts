import type { MigrationInterface, QueryRunner } from 'typeorm';

export class GuestVotingSupport1764310000000 implements MigrationInterface {
  name = 'GuestVotingSupport1764310000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "event_votes"
      ADD COLUMN IF NOT EXISTS "voterKey" character varying
    `);
    await queryRunner.query(`
      ALTER TABLE "event_votes"
      ADD COLUMN IF NOT EXISTS "guestName" character varying
    `);
    await queryRunner.query(`
      ALTER TABLE "event_votes"
      ALTER COLUMN "userId" DROP NOT NULL
    `);
    await queryRunner.query(`
      UPDATE "event_votes"
      SET "voterKey" = CONCAT('user:', "userId")
      WHERE "voterKey" IS NULL AND "userId" IS NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "event_votes"
      ALTER COLUMN "voterKey" SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "event_votes"
      DROP CONSTRAINT IF EXISTS "UQ_event_votes_event_user_game"
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'UQ_bf82d0f7a3076270ec4ccf5bc08'
        ) THEN
          ALTER TABLE "event_votes"
          DROP CONSTRAINT "UQ_bf82d0f7a3076270ec4ccf5bc08";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE "event_votes"
      ADD CONSTRAINT "UQ_event_votes_event_voter_game"
      UNIQUE ("eventId","voterKey","gameId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "event_votes"
      DROP CONSTRAINT IF EXISTS "UQ_event_votes_event_voter_game"
    `);
    await queryRunner.query(`
      ALTER TABLE "event_votes"
      ADD CONSTRAINT "UQ_event_votes_event_user_game"
      UNIQUE ("eventId","userId","gameId")
    `);
    await queryRunner.query(`
      ALTER TABLE "event_votes"
      ALTER COLUMN "userId" SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "event_votes"
      DROP COLUMN IF EXISTS "guestName"
    `);
    await queryRunner.query(`
      ALTER TABLE "event_votes"
      DROP COLUMN IF EXISTS "voterKey"
    `);
  }
}
