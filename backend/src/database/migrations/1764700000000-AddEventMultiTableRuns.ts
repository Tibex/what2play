import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEventMultiTableRuns1764700000000 implements MigrationInterface {
  name = 'AddEventMultiTableRuns1764700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "event_multi_table_runs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "eventId" uuid NOT NULL,
        "tableCount" integer NOT NULL,
        "candidateGameIds" text,
        "locks" text,
        "result" text NOT NULL,
        "parentRunId" uuid,
        "committedAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_event_multi_table_runs_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_event_multi_table_runs_event_created"
      ON "event_multi_table_runs" ("eventId", "createdAt")
    `);
    await queryRunner.query(`
      ALTER TABLE "event_multi_table_runs"
      ADD CONSTRAINT "FK_event_multi_table_runs_event"
      FOREIGN KEY ("eventId") REFERENCES "events"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "event_multi_table_runs" DROP CONSTRAINT "FK_event_multi_table_runs_event"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_event_multi_table_runs_event_created"`,
    );
    await queryRunner.query(`DROP TABLE "event_multi_table_runs"`);
  }
}
