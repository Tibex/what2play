import type { MigrationInterface, QueryRunner } from 'typeorm';

export class NormalizeGameTitleEntities1764375000000 implements MigrationInterface {
  name = 'NormalizeGameTitleEntities1764375000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "games"
      SET "title" = REPLACE(
        REPLACE(
          REPLACE(
            REPLACE(
              REPLACE(
                REPLACE(
                  REPLACE("title", '&amp;', '&'),
                '&apos;', ''''),
              '&#039;', ''''),
            '&#39;', ''''),
          '&quot;', '"'),
        '&lt;', '<'),
      '&gt;', '>')
      WHERE "title" LIKE '%&amp;%'
         OR "title" LIKE '%&apos;%'
         OR "title" LIKE '%&#039;%'
         OR "title" LIKE '%&#39;%'
         OR "title" LIKE '%&quot;%'
         OR "title" LIKE '%&lt;%'
         OR "title" LIKE '%&gt;%'
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Irreversible normalization.
  }
}
