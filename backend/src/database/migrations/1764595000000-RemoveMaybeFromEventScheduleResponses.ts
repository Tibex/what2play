import type { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveMaybeFromEventScheduleResponses1764595000000 implements MigrationInterface {
  name = 'RemoveMaybeFromEventScheduleResponses1764595000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "event_schedule_responses"
      SET "answer" = 'no'
      WHERE LOWER("answer") = 'maybe'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`SELECT 1`);
  }
}
