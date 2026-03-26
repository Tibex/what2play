import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

const describeIfDb =
  process.env.RUN_DB_E2E === 'true' ? describe : describe.skip;

describeIfDb('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/api/docs (GET)', () => {
    return request(app.getHttpServer()).get('/api/docs').expect(200);
  });
});
