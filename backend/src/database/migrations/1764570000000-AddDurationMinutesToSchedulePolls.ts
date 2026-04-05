import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDurationMinutesToSchedulePolls1764570000000
  implements MigrationInterface
{
  name = 'AddDurationMinutesToSchedulePolls1764570000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "schedule_polls"
      ADD COLUMN IF NOT EXISTS "durationMinutes" integer
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "schedule_polls"
      DROP COLUMN IF EXISTS "durationMinutes"
    `);
  }
}
