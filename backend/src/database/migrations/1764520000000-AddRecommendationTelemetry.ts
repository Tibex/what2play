import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRecommendationTelemetry1764520000000 implements MigrationInterface {
  name = 'AddRecommendationTelemetry1764520000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "recommendation_telemetry" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "eventId" uuid,
        "userId" uuid,
        "eventName" character varying NOT NULL,
        "payload" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_recommendation_telemetry_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_recommendation_telemetry_eventId_createdAt"
      ON "recommendation_telemetry" ("eventId", "createdAt")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_recommendation_telemetry_eventName_createdAt"
      ON "recommendation_telemetry" ("eventName", "createdAt")
    `);
    await queryRunner.query(`
      ALTER TABLE "recommendation_telemetry"
      ADD CONSTRAINT "FK_recommendation_telemetry_event"
      FOREIGN KEY ("eventId") REFERENCES "events"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "recommendation_telemetry"
      ADD CONSTRAINT "FK_recommendation_telemetry_user"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "recommendation_telemetry"
      DROP CONSTRAINT IF EXISTS "FK_recommendation_telemetry_user"
    `);
    await queryRunner.query(`
      ALTER TABLE "recommendation_telemetry"
      DROP CONSTRAINT IF EXISTS "FK_recommendation_telemetry_event"
    `);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_recommendation_telemetry_eventName_createdAt"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_recommendation_telemetry_eventId_createdAt"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "recommendation_telemetry"`);
  }
}
