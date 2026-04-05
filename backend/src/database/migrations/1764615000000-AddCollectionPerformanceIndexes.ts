import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCollectionPerformanceIndexes1764615000000 implements MigrationInterface {
  name = 'AddCollectionPerformanceIndexes1764615000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_events_selectedGameId"
      ON "events" ("selectedGameId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_event_feedback_gameId"
      ON "event_feedback" ("gameId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_event_feedback_gameId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_events_selectedGameId"`);
  }
}
