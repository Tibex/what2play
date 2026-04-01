import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOpenEventReports1764530000000 implements MigrationInterface {
  name = 'AddOpenEventReports1764530000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "event_reports" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "eventId" uuid NOT NULL,
        "reporterUserId" uuid NOT NULL,
        "reason" character varying NOT NULL,
        "details" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_event_reports_event_reporter" UNIQUE ("eventId", "reporterUserId"),
        CONSTRAINT "FK_event_reports_event" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_event_reports_reporter" FOREIGN KEY ("reporterUserId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_event_reports_eventId_createdAt"
      ON "event_reports" ("eventId", "createdAt")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_event_reports_reporterUserId"
      ON "event_reports" ("reporterUserId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_event_reports_reporterUserId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_event_reports_eventId_createdAt"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "event_reports"`);
  }
}
