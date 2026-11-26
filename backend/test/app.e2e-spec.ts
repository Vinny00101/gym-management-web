import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { setupApp } from './../src/app/setup-app.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

describe('App (e2e)', () => {
  let app: INestApplication<App>;
  let AppModule: typeof import('./../src/app.module.js').AppModule;

  beforeAll(async () => {
    // O seed precisa de ADMIN_NAME; o teste não depende do .env da máquina.
    process.env.ADMIN_NAME ??= 'Administrador';
    ({ AppModule } = await import('./../src/app.module.js'));
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $connect: vi.fn(),
        $disconnect: vi.fn(),
        $queryRaw: vi.fn().mockResolvedValue([{ ok: 1 }]),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer()).get('/health').expect(200);
  });

  it('returns a generated X-Request-Id header', async () => {
    const response = await request(app.getHttpServer()).get('/health');

    expect(response.headers['x-request-id']).toBeDefined();
  });

  it('preserves an incoming X-Request-Id header', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .set('X-Request-Id', 'test-request-id');

    expect(response.headers['x-request-id']).toBe('test-request-id');
  });

  afterEach(async () => {
    await app?.close();
  });
});
