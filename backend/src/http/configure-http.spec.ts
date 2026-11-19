import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TerminusModule } from '@nestjs/terminus';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppController } from '../controllers/app.controller.js';
import { HealthController } from '../controllers/health.controller.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AppService } from '../services/app.service.js';
import { configureHttp } from './configure-http.js';

describe('HTTP configuration', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TerminusModule],
      controllers: [AppController, HealthController],
      providers: [
        AppService,
        {
          provide: PrismaService,
          useValue: { $queryRaw: vi.fn().mockResolvedValue([{ result: 1 }]) },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureHttp(app);
    await app.init();
  });

  it('serves Swagger UI and OpenAPI with Bearer authentication', async () => {
    await request(app.getHttpServer())
      .get('/api/docs/')
      .expect(200)
      .expect('Content-Security-Policy', /default-src 'self'/);

    const response = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);

    expect(response.body.paths).toHaveProperty('/health');
    expect(response.body.components.securitySchemes).toHaveProperty('bearer');
  });

  afterEach(async () => {
    await app.close();
  });
});
