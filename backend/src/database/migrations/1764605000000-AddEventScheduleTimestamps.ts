import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEventScheduleTimestamps1764605000000
  implements MigrationInterface
{
  name = 'AddEventScheduleTimestamps1764605000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "event_schedule_slots"
      ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP NOT NULL DEFAULT now()
    `);
    await queryRunner.query(`
      ALTER TABLE "event_schedule_slots"
      ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
    `);
    await queryRunner.query(`
      ALTER TABLE "event_schedule_responses"
      ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP NOT NULL DEFAULT now()
    `);
    await queryRunner.query(`
      ALTER TABLE "event_schedule_responses"
      ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "event_schedule_responses"
      DROP COLUMN IF EXISTS "updatedAt"
    `);
    await queryRunner.query(`
      ALTER TABLE "event_schedule_responses"
      DROP COLUMN IF EXISTS "createdAt"
    `);
    await queryRunner.query(`
      ALTER TABLE "event_schedule_slots"
      DROP COLUMN IF EXISTS "updatedAt"
    `);
    await queryRunner.query(`
      ALTER TABLE "event_schedule_slots"
      DROP COLUMN IF EXISTS "createdAt"
    `);
  }
}
