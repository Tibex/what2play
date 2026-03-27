import type { MigrationInterface, QueryRunner } from 'typeorm';

export class EventTimezoneAndSessionColumns1764300000000 implements MigrationInterface {
  name = 'EventTimezoneAndSessionColumns1764300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "events"
      ADD COLUMN IF NOT EXISTS "eventTimezone" character varying NOT NULL DEFAULT 'UTC'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events" DROP COLUMN IF EXISTS "eventTimezone"`,
    );
  }
}
