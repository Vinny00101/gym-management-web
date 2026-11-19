import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('returns a generated X-Request-Id header', async () => {
    const response = await request(app.getHttpServer()).get('/');

    expect(response.headers['x-request-id']).toBeDefined();
  });

  it('preserves an incoming X-Request-Id header', async () => {
    const response = await request(app.getHttpServer())
      .get('/')
      .set('X-Request-Id', 'test-request-id');

    expect(response.headers['x-request-id']).toBe('test-request-id');
  });

  afterEach(async () => {
    await app.close();
  });
});
