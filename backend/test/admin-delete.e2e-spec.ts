import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { User } from '../src/entities/user.entity';
import { Event } from '../src/entities/event.entity';

const describeIfDb =
  process.env.RUN_DB_E2E === 'true' ? describe : describe.skip;

describeIfDb('Admin delete endpoints (e2e)', () => {
  let app: INestApplication<App>;
  let usersRepo: Repository<User>;
  let eventsRepo: Repository<Event>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    usersRepo = moduleFixture.get(getRepositoryToken(User));
    eventsRepo = moduleFixture.get(getRepositoryToken(Event));
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('forbids non-admin and allows admin to delete an event', async () => {
    const host = await registerUser('event-host');
    const nonAdmin = await registerUser('event-user');
    const admin = await createAdminUser('event-admin');

    const createdEvent = await request(app.getHttpServer())
      .post('/api/events')
      .set('Authorization', `Bearer ${host.accessToken}`)
      .send({
        title: 'Admin Delete Event',
        dateTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        durationMinutes: 120,
        type: 'invite',
      })
      .expect(201);
    const eventId = createdEvent.body.id as string;

    await request(app.getHttpServer())
      .delete(`/api/events/admin/${eventId}`)
      .set('Authorization', `Bearer ${nonAdmin.accessToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/api/events/admin/${eventId}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/events/${eventId}`)
      .set('Authorization', `Bearer ${host.accessToken}`)
      .expect(404);
  });

  it('deletes user and their hosted events via admin endpoint', async () => {
    const victim = await registerUser('victim-user');
    const admin = await createAdminUser('victim-admin');

    const createdEvent = await request(app.getHttpServer())
      .post('/api/events')
      .set('Authorization', `Bearer ${victim.accessToken}`)
      .send({
        title: 'Victim Hosted Event',
        dateTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        durationMinutes: 90,
        type: 'invite',
      })
      .expect(201);
    const eventId = createdEvent.body.id as string;

    await request(app.getHttpServer())
      .delete(`/api/users/${victim.user.id}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: victim.email, password: victim.password })
      .expect(401);

    const usersList = await request(app.getHttpServer())
      .get('/api/users?page=1&pageSize=100')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);
    expect(
      usersList.body.items.some((u: { id: string }) => u.id === victim.user.id),
    ).toBe(false);

    const dbEvent = await eventsRepo.findOne({ where: { id: eventId } });
    expect(dbEvent).toBeNull();
  });

  it('rejects admin self-delete', async () => {
    const admin = await createAdminUser('self-delete-admin');

    await request(app.getHttpServer())
      .delete(`/api/users/${admin.user.id}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(403);
  });

  it('returns admin dashboard summary and activity endpoints', async () => {
    const admin = await createAdminUser('metrics-admin');
    const member = await registerUser('metrics-member');

    const createdEvent = await request(app.getHttpServer())
      .post('/api/events')
      .set('Authorization', `Bearer ${member.accessToken}`)
      .send({
        title: 'Metrics Event',
        dateTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
        durationMinutes: 60,
        type: 'open',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/events/${createdEvent.body.id}/report`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ reason: 'spam' })
      .expect(201);

    await request(app.getHttpServer())
      .get('/api/users/admin/summary')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200)
      .expect((res) => {
        expect(typeof res.body.totalUsers).toBe('number');
        expect(typeof res.body.totalAdmins).toBe('number');
      });

    await request(app.getHttpServer())
      .get('/api/events/admin/summary')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200)
      .expect((res) => {
        expect(typeof res.body.totalEvents).toBe('number');
        expect(typeof res.body.reportsLast7d).toBe('number');
      });

    await request(app.getHttpServer())
      .get('/api/events/admin/activity?page=1&pageSize=20')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body.items)).toBe(true);
        expect(res.body.items.length).toBeGreaterThan(0);
      });
  });

  it('exposes incomplete catalog entries to admin only', async () => {
    const nonAdmin = await registerUser('catalog-user');
    const admin = await createAdminUser('catalog-admin');

    await request(app.getHttpServer())
      .get('/api/bgg/admin/incomplete-catalog?limit=5')
      .set('Authorization', `Bearer ${nonAdmin.accessToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .get('/api/bgg/admin/incomplete-catalog?limit=5')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body.items)).toBe(true);
        expect(typeof res.body.meta?.page).toBe('number');
        expect(typeof res.body.meta?.pageSize).toBe('number');
        expect(typeof res.body.meta?.total).toBe('number');
        expect(typeof res.body.meta?.hasNext).toBe('boolean');
      });
  });

  async function createAdminUser(alias: string) {
    const registered = await registerUser(alias);
    await usersRepo.update(registered.user.id, { role: 'admin' });
    return login(registered.email, registered.password);
  }

  async function registerUser(alias: string) {
    const unique = `${alias}.${Date.now()}.${Math.random().toString(36).slice(2)}`;
    const email = `${unique}@example.com`;
    const password = `${alias}.Pwd.${Date.now()}!Aa9`;

    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email,
        password,
        name: alias,
      })
      .expect(201);

    return {
      ...(res.body as {
        user: { id: string };
        accessToken: string;
        refreshToken: string;
      }),
      email,
      password,
    };
  }

  async function login(email: string, password: string) {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);

    return {
      ...(res.body as {
        user: { id: string };
        accessToken: string;
        refreshToken: string;
      }),
      email,
      password,
    };
  }
});
