import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserRoleAndAdminBootstrap1764370000000 implements MigrationInterface {
  name = 'AddUserRoleAndAdminBootstrap1764370000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "role" character varying NOT NULL DEFAULT 'user'
    `);

    await queryRunner.query(`
      UPDATE "users"
      SET "role" = 'admin'
      WHERE LOWER("email") = LOWER('tibexor@gmail.com')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "role"
    `);
  }
}
