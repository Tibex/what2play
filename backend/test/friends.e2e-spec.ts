import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

const describeIfDb =
  process.env.RUN_DB_E2E === 'true' ? describe : describe.skip;

describeIfDb('Friends (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('auto-accepts when both users send request to each other', async () => {
    const userA = await registerUser('friendA');
    const userB = await registerUser('friendB');

    const first = await request(app.getHttpServer())
      .post('/api/friends/request-by-user-id')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({ userId: userB.user.id })
      .expect(201);
    expect(first.body).toEqual({ status: 'sent' });

    const second = await request(app.getHttpServer())
      .post('/api/friends/request-by-user-id')
      .set('Authorization', `Bearer ${userB.accessToken}`)
      .send({ userId: userA.user.id })
      .expect(201);
    expect(second.body).toEqual({ status: 'already_friends' });

    const pendingForA = await request(app.getHttpServer())
      .get('/api/friends/pending')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .expect(200);
    expect(pendingForA.body).toEqual([]);

    const pendingForB = await request(app.getHttpServer())
      .get('/api/friends/pending')
      .set('Authorization', `Bearer ${userB.accessToken}`)
      .expect(200);
    expect(pendingForB.body).toEqual([]);

    const friendsForA = await request(app.getHttpServer())
      .get('/api/friends')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .expect(200);
    expect(friendsForA.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: userB.user.id })]),
    );

    const friendsForB = await request(app.getHttpServer())
      .get('/api/friends')
      .set('Authorization', `Bearer ${userB.accessToken}`)
      .expect(200);
    expect(friendsForB.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: userA.user.id })]),
    );
  });

  it('returns sent pending requests for requester', async () => {
    const requester = await registerUser('friendSentRequester');
    const addressee = await registerUser('friendSentAddressee');

    await request(app.getHttpServer())
      .post('/api/friends/request-by-user-id')
      .set('Authorization', `Bearer ${requester.accessToken}`)
      .send({ userId: addressee.user.id })
      .expect(201);

    const sentPending = await request(app.getHttpServer())
      .get('/api/friends/pending/sent')
      .set('Authorization', `Bearer ${requester.accessToken}`)
      .expect(200);

    expect(sentPending.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          requesterId: requester.user.id,
          addresseeId: addressee.user.id,
          status: 'pending',
          addressee: expect.objectContaining({ id: addressee.user.id }),
        }),
      ]),
    );

    const incomingForAddressee = await request(app.getHttpServer())
      .get('/api/friends/pending')
      .set('Authorization', `Bearer ${addressee.accessToken}`)
      .expect(200);

    expect(incomingForAddressee.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          requesterId: requester.user.id,
          addresseeId: addressee.user.id,
          status: 'pending',
        }),
      ]),
    );
  });

  async function registerUser(alias: string) {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: `${alias}.${Date.now()}.${Math.random().toString(36).slice(2)}@example.com`,
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
