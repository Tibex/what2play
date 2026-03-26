import type { MigrationInterface, QueryRunner } from 'typeorm';

export class BaselineSchema1760000000000 implements MigrationInterface {
  name = 'BaselineSchema1760000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" character varying NOT NULL UNIQUE,
        "password" character varying,
        "name" character varying NOT NULL,
        "avatarUrl" character varying,
        "timezone" character varying,
        "preferredDuration" integer,
        "preferredWeight" numeric(3,2),
        "socialProvider" character varying,
        "socialId" character varying,
        "subscriptionTier" character varying NOT NULL DEFAULT 'free',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "games" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "bggId" integer UNIQUE,
        "title" character varying NOT NULL,
        "description" text,
        "imageUrl" character varying,
        "thumbnailUrl" character varying,
        "minPlayers" integer NOT NULL DEFAULT 1,
        "maxPlayers" integer NOT NULL DEFAULT 4,
        "playingTime" integer,
        "minPlayTime" integer,
        "maxPlayTime" integer,
        "weight" numeric(4,2),
        "yearPublished" integer,
        "bggRating" numeric(4,2),
        "categories" text,
        "mechanics" text,
        "isExpansion" boolean NOT NULL DEFAULT false,
        "expansionForBggIds" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "hostId" uuid NOT NULL,
        "title" character varying NOT NULL,
        "description" text,
        "dateTime" timestamptz NOT NULL,
        "durationMinutes" integer,
        "location" character varying,
        "capacity" integer,
        "type" character varying NOT NULL DEFAULT 'invite',
        "status" character varying NOT NULL DEFAULT 'planning',
        "votingDeadline" timestamptz,
        "selectedGameId" uuid,
        "discoveryMode" boolean NOT NULL DEFAULT false,
        "excludedGameIds" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_events_host" FOREIGN KEY ("hostId") REFERENCES "users"("id") ON DELETE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "friendships" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "requesterId" uuid NOT NULL,
        "addresseeId" uuid NOT NULL,
        "status" character varying NOT NULL DEFAULT 'pending',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_friendships_requester_addressee" UNIQUE ("requesterId","addresseeId"),
        CONSTRAINT "FK_friendships_requester" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_friendships_addressee" FOREIGN KEY ("addresseeId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_game_ownership" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "gameId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_user_game_ownership_user_game" UNIQUE ("userId","gameId"),
        CONSTRAINT "FK_ownership_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_ownership_game" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_game_ratings" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "gameId" uuid NOT NULL,
        "rating" numeric(3,1) NOT NULL,
        "notes" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_user_game_ratings_user_game" UNIQUE ("userId","gameId"),
        CONSTRAINT "FK_ratings_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_ratings_game" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "event_attendees" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "eventId" uuid NOT NULL,
        "userId" uuid,
        "rsvpStatus" character varying NOT NULL DEFAULT 'going',
        "isGuest" boolean NOT NULL DEFAULT false,
        "guestName" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_event_attendees_event_user" UNIQUE ("eventId","userId"),
        CONSTRAINT "FK_event_attendees_event" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_event_attendees_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "event_invites" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "eventId" uuid NOT NULL,
        "token" character varying NOT NULL,
        "email" character varying,
        "used" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_event_invites_event" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "event_game_candidates" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "eventId" uuid NOT NULL,
        "gameId" uuid NOT NULL,
        "source" character varying NOT NULL DEFAULT 'owned',
        "score" numeric(5,2),
        "explanation" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_event_game_candidates_event" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_event_game_candidates_game" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "event_votes" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "eventId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "gameId" uuid NOT NULL,
        "rank" integer NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_event_votes_event_user_game" UNIQUE ("eventId","userId","gameId"),
        CONSTRAINT "FK_event_votes_event" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_event_votes_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_event_votes_game" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "event_feedback" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "eventId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "gameId" uuid,
        "enjoymentRating" integer NOT NULL,
        "finishedGame" boolean NOT NULL DEFAULT false,
        "durationFeel" character varying,
        "notes" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_event_feedback_event" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_event_feedback_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_event_feedback_game" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "session_timings" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "eventId" uuid NOT NULL,
        "gameId" uuid NOT NULL,
        "playerCount" integer NOT NULL,
        "setupMinutes" integer,
        "gameplayMinutes" integer,
        "totalMinutes" integer,
        "completed" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_session_timings_event" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_session_timings_game" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sync_accounts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "provider" character varying NOT NULL DEFAULT 'bgg',
        "externalUsername" character varying NOT NULL,
        "lastSyncedAt" timestamptz,
        "status" character varying NOT NULL DEFAULT 'linked',
        "verified" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_sync_accounts_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "bgg_verification_challenges" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "token" character varying NOT NULL,
        "status" character varying NOT NULL DEFAULT 'pending',
        "expiresAt" timestamptz NOT NULL,
        "verifiedAt" timestamptz,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_bgg_verification_challenges_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notification_deliveries" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "eventId" uuid NOT NULL,
        "type" character varying NOT NULL,
        "idempotencyKey" character varying NOT NULL UNIQUE,
        "endpoint" text,
        "payload" text,
        "delivered" boolean NOT NULL DEFAULT false,
        "attempts" integer NOT NULL DEFAULT 0,
        "lastError" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "lastAttemptAt" TIMESTAMP,
        "deliveredAt" TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "notification_deliveries"
      ADD COLUMN IF NOT EXISTS "lastAttemptAt" TIMESTAMP
    `);
    await queryRunner.query(`
      ALTER TABLE "notification_deliveries"
      ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP
    `);
    await queryRunner.query(`
      ALTER TABLE "notification_deliveries"
      ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_event_votes_eventId" ON "event_votes" ("eventId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_event_feedback_eventId" ON "event_feedback" ("eventId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notification_deliveries_delivered_attempts"
      ON "notification_deliveries" ("delivered", "attempts", "createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "notification_deliveries"`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "bgg_verification_challenges"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "sync_accounts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "session_timings"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "event_feedback"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "event_votes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "event_game_candidates"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "event_invites"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "event_attendees"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_game_ratings"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_game_ownership"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "friendships"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "games"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
  }
}
