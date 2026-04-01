import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { Game } from '../src/entities/game.entity';
import { UserGameOwnership } from '../src/entities/user-game-ownership.entity';

const describeIfDb =
  process.env.RUN_DB_E2E === 'true' ? describe : describe.skip;

describeIfDb('Event lifecycle (e2e)', () => {
  let app: INestApplication<App>;
  let gamesRepo: Repository<Game>;
  let ownershipRepo: Repository<UserGameOwnership>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    gamesRepo = moduleFixture.get(getRepositoryToken(Game));
    ownershipRepo = moduleFixture.get(getRepositoryToken(UserGameOwnership));
  });

  afterAll(async () => {
    await app.close();
  });

  it('covers RSVP -> recommendations -> voting -> feedback -> host analytics', async () => {
    const host = await registerUser('host');
    const guestA = await registerUser('guestA');
    const guestB = await registerUser('guestB');

    const game1 = await gamesRepo.save(
      gamesRepo.create({
        title: 'Terraforming Mars',
        minPlayers: 1,
        maxPlayers: 5,
        playingTime: 120,
      }),
    );
    const game2 = await gamesRepo.save(
      gamesRepo.create({
        title: 'Codenames',
        minPlayers: 2,
        maxPlayers: 8,
        playingTime: 30,
      }),
    );

    await ownershipRepo.save(
      ownershipRepo.create({ userId: host.user.id, gameId: game1.id }),
    );
    await ownershipRepo.save(
      ownershipRepo.create({ userId: guestA.user.id, gameId: game2.id }),
    );

    const createdEvent = await request(app.getHttpServer())
      .post('/api/events')
      .set('Authorization', `Bearer ${host.accessToken}`)
      .send({
        title: 'Friday Night Session',
        dateTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        durationMinutes: 180,
        type: 'invite',
      })
      .expect(201);
    const eventId = createdEvent.body.id as string;

    await request(app.getHttpServer())
      .post(`/api/events/${eventId}/rsvp`)
      .set('Authorization', `Bearer ${guestA.accessToken}`)
      .send({ status: 'going' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/events/${eventId}/rsvp`)
      .set('Authorization', `Bearer ${guestB.accessToken}`)
      .send({ status: 'going' })
      .expect(201);

    const generated = await request(app.getHttpServer())
      .post(`/api/events/${eventId}/recommendations/generate`)
      .set('Authorization', `Bearer ${host.accessToken}`)
      .expect(201);
    expect(generated.body.length).toBeGreaterThan(0);

    await request(app.getHttpServer())
      .patch(`/api/events/${eventId}`)
      .set('Authorization', `Bearer ${host.accessToken}`)
      .send({
        status: 'voting',
        votingDeadline: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/events/${eventId}/voting`)
      .set('Authorization', `Bearer ${host.accessToken}`)
      .send({
        rankings: [
          { gameId: game1.id, rank: 1 },
          { gameId: game2.id, rank: 2 },
        ],
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/events/${eventId}/voting`)
      .set('Authorization', `Bearer ${guestA.accessToken}`)
      .send({
        rankings: [
          { gameId: game2.id, rank: 1 },
          { gameId: game1.id, rank: 2 },
        ],
      })
      .expect(201);

    const finalVote = await request(app.getHttpServer())
      .post(`/api/events/${eventId}/voting`)
      .set('Authorization', `Bearer ${guestB.accessToken}`)
      .send({
        rankings: [
          { gameId: game2.id, rank: 1 },
          { gameId: game1.id, rank: 2 },
        ],
      })
      .expect(201);
    expect(finalVote.body.length).toBeGreaterThan(0);

    const votingStatus = await request(app.getHttpServer())
      .get(`/api/events/${eventId}/voting/status`)
      .set('Authorization', `Bearer ${host.accessToken}`)
      .expect(200);
    expect(votingStatus.body.allVoted).toBe(true);

    const eventAfterVotes = await request(app.getHttpServer())
      .get(`/api/events/${eventId}`)
      .set('Authorization', `Bearer ${host.accessToken}`)
      .expect(200);
    expect(eventAfterVotes.body.status).toBe('confirmed');
    expect(eventAfterVotes.body.selectedGameId).toBe(game2.id);

    await request(app.getHttpServer())
      .patch(`/api/events/${eventId}`)
      .set('Authorization', `Bearer ${host.accessToken}`)
      .send({
        status: 'completed',
        dateTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/events/${eventId}/feedback`)
      .set('Authorization', `Bearer ${host.accessToken}`)
      .send({
        enjoymentRating: 5,
        finishedGame: true,
        playedGames: [
          {
            gameId: game2.id,
            enjoymentRating: 5,
            finishedGame: true,
            durationFeel: 'just_right',
          },
        ],
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/events/${eventId}/feedback`)
      .set('Authorization', `Bearer ${guestA.accessToken}`)
      .send({
        enjoymentRating: 4,
        finishedGame: true,
        playedGames: [
          {
            gameId: game2.id,
            enjoymentRating: 4,
            finishedGame: true,
            durationFeel: 'just_right',
          },
        ],
      })
      .expect(201);

    const outcomeAnalytics = await request(app.getHttpServer())
      .get(`/api/events/${eventId}/outcome-analytics`)
      .set('Authorization', `Bearer ${host.accessToken}`)
      .expect(200);
    expect(outcomeAnalytics.body.outcomes.selectedGameId).toBe(game2.id);
    expect(outcomeAnalytics.body.outcomes.totalFeedbackEntries).toBe(2);
  });

  it('enforces open-event discovery and invite-only visibility rules', async () => {
    const host = await registerUser('host-open');
    const outsider = await registerUser('outsider-open');

    const openEventRes = await request(app.getHttpServer())
      .post('/api/events')
      .set('Authorization', `Bearer ${host.accessToken}`)
      .send({
        title: 'Open Sunday Session',
        dateTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        durationMinutes: 180,
        type: 'open',
      })
      .expect(201);
    const openEventId = openEventRes.body.id as string;

    const openDiscovery = await request(app.getHttpServer())
      .get('/api/events/open')
      .set('Authorization', `Bearer ${outsider.accessToken}`)
      .expect(200);
    expect(
      openDiscovery.body.some(
        (event: { id: string }) => event.id === openEventId,
      ),
    ).toBe(true);

    await request(app.getHttpServer())
      .post(`/api/events/${openEventId}/rsvp`)
      .set('Authorization', `Bearer ${outsider.accessToken}`)
      .send({ status: 'going' })
      .expect(201);

    const inviteEventRes = await request(app.getHttpServer())
      .post('/api/events')
      .set('Authorization', `Bearer ${host.accessToken}`)
      .send({
        title: 'Private Invite Session',
        dateTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
        durationMinutes: 120,
        type: 'invite',
      })
      .expect(201);
    const inviteEventId = inviteEventRes.body.id as string;

    await request(app.getHttpServer())
      .get(`/api/events/${inviteEventId}`)
      .set('Authorization', `Bearer ${outsider.accessToken}`)
      .expect(404);

    const inviteLinkRes = await request(app.getHttpServer())
      .post(`/api/events/${inviteEventId}/invite-link`)
      .set('Authorization', `Bearer ${host.accessToken}`)
      .expect(201);
    const inviteToken = inviteLinkRes.body.token as string;

    await request(app.getHttpServer())
      .post(`/api/events/invite/${inviteToken}/join`)
      .set('Authorization', `Bearer ${outsider.accessToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/events/${inviteEventId}`)
      .set('Authorization', `Bearer ${outsider.accessToken}`)
      .expect(200);
  });

  async function registerUser(alias: string) {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: `${alias}.${Date.now()}@example.com`,
        password: 'StrongPass123!',
        name: alias,
      })
      .expect(201);

    return res.body as {
      user: { id: string };
      accessToken: string;
      refreshToken: string;
    };
  }
});
