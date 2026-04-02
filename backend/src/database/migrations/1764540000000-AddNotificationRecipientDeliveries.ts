import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotificationRecipientDeliveries1764540000000
  implements MigrationInterface
{
  name = 'AddNotificationRecipientDeliveries1764540000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notification_recipient_deliveries" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "eventId" uuid NOT NULL,
        "type" character varying NOT NULL,
        "recipientKey" character varying NOT NULL,
        "recipientUserId" uuid,
        "recipientEmail" character varying,
        "idempotencyKey" character varying NOT NULL,
        "deliveredAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_notification_recipient_deliveries_scope"
          UNIQUE ("eventId", "type", "recipientKey"),
        CONSTRAINT "FK_notification_recipient_deliveries_event"
          FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_notification_recipient_deliveries_user"
          FOREIGN KEY ("recipientUserId") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notification_recipient_deliveries_event_type"
      ON "notification_recipient_deliveries" ("eventId", "type")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notification_recipient_deliveries_idempotency"
      ON "notification_recipient_deliveries" ("idempotencyKey")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_notification_recipient_deliveries_idempotency"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_notification_recipient_deliveries_event_type"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "notification_recipient_deliveries"`,
    );
  }
}
