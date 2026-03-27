import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBggPlayerCountPollToGames1764380000000 implements MigrationInterface {
  name = 'AddBggPlayerCountPollToGames1764380000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "games"
      ADD COLUMN IF NOT EXISTS "bggPlayerCountPoll" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "games"
      DROP COLUMN IF EXISTS "bggPlayerCountPoll"
    `);
  }
}
