import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

const describeIfDb =
  process.env.RUN_DB_E2E === 'true' ? describe : describe.skip;

describeIfDb('Event scheduling (e2e)', () => {
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

  it('creates scheduling event, guest responds, host finalizes to planning', async () => {
    const host = await registerUser('schedHost');
    const guest = await registerUser('schedGuest');

    await request(app.getHttpServer())
      .post('/api/friends/request-by-user-id')
      .set('Authorization', `Bearer ${host.accessToken}`)
      .send({ userId: guest.user.id })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/friends/request-by-user-id')
      .set('Authorization', `Bearer ${guest.accessToken}`)
      .send({ userId: host.user.id })
      .expect(201);

    const slotA = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const slotB = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

    const created = await request(app.getHttpServer())
      .post('/api/events')
      .set('Authorization', `Bearer ${host.accessToken}`)
      .send({
        title: 'Poll the night',
        useAvailabilityPoll: true,
        availabilitySlots: [
          { start: slotA, label: 'Fri' },
          { start: slotB, label: 'Sat' },
        ],
        durationMinutes: 180,
        type: 'invite',
        eventTimezone: 'UTC',
      })
      .expect(201);

    const eventId = created.body.id as string;
    expect(created.body.status).toBe('scheduling');
    expect(created.body.dateTime).toBeNull();

    await request(app.getHttpServer())
      .post(`/api/events/${eventId}/invite-friends`)
      .set('Authorization', `Bearer ${host.accessToken}`)
      .send({ userIds: [guest.user.id] })
      .expect(201);

    const detailGuest = await request(app.getHttpServer())
      .get(`/api/events/${eventId}/schedule`)
      .set('Authorization', `Bearer ${guest.accessToken}`)
      .expect(200);

    const slotIdA = detailGuest.body.slots[0].id as string;
    const slotIdB = detailGuest.body.slots[1].id as string;

    await request(app.getHttpServer())
      .patch(`/api/events/${eventId}/schedule/responses`)
      .set('Authorization', `Bearer ${guest.accessToken}`)
      .send({
        responses: { [slotIdA]: 'yes', [slotIdB]: 'no' },
      })
      .expect(200);

    const finalized = await request(app.getHttpServer())
      .post(`/api/events/${eventId}/schedule/finalize`)
      .set('Authorization', `Bearer ${host.accessToken}`)
      .send({ winningSlotId: slotIdA })
      .expect(201);

    expect(finalized.body.status).toBe('planning');
    expect(finalized.body.dateTime).toBeDefined();
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
