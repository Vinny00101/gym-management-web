import { Test, TestingModule } from '@nestjs/testing';
import { TerminusModule } from '@nestjs/terminus';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { HealthController } from './health.controller.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('HealthController', () => {
  let app: INestApplication<App>;
  let queryRaw: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    queryRaw = vi.fn().mockResolvedValue([{ result: 1 }]);
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TerminusModule],
      controllers: [HealthController],
      providers: [
        {
          provide: PrismaService,
          useValue: { $queryRaw: queryRaw },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('reports the API healthy when the database responds', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);

    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(response.body.status).toBe('ok');
    expect(response.body.details.database.status).toBe('up');
  });

  it('reports the API unavailable when the database query fails', async () => {
    queryRaw.mockRejectedValue(new Error('database connection failure'));

    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(503);

    expect(response.body.status).toBe('error');
    expect(response.body.details.database.message).toBe(
      'Database is unavailable',
    );
  });

  afterEach(async () => {
    await app.close();
  });
});
