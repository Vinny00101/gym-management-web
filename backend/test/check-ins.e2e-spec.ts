import {
  INestApplication,
  MiddlewareConsumer,
  Module,
  NestModule,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { LoggerModule } from 'nestjs-pino';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { setupApp } from '../src/app/setup-app.js';
import { CheckInsModule } from '../src/modules/check-ins/check-ins.module.js';
import { Prisma } from '../src/generated/prisma/client.js';
import { Role, UserStatus } from '../src/generated/prisma/enums.js';
import { PrismaModule } from '../src/infra/database/prisma.module.js';
import { PrismaService } from '../src/infra/database/prisma.service.js';
import { AuthGuardsModule } from '../src/shared/identity/auth-guards.module.js';
import { RequestIdMiddleware } from '../src/shared/middleware/request-id.middleware.js';
import { getSaoPauloLocalDate } from '../src/modules/check-ins/check-ins.service.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
      load: [
        () => ({
          JWT_SECRET: 'integration-test-secret-with-more-than-32-chars',
          JWT_EXPIRES_IN: '15m',
          REFRESH_TOKEN_EXPIRES_IN: '7d',
          NODE_ENV: 'test',
          DATABASE_URL: 'postgresql://unused:unused@localhost:5432/unused',
        }),
      ],
    }),
    LoggerModule.forRoot({ pinoHttp: { enabled: false } }),
    PrismaModule,
    AuthGuardsModule,
    CheckInsModule,
  ],
})
class CheckInsTestModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}

describe('Check-ins (e2e)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;

  const users = new Map([
    [1, { id: 1, role: Role.admin, status: UserStatus.active }],
    [2, { id: 2, role: Role.trainer, status: UserStatus.active }],
    [7, { id: 7, role: Role.member, status: UserStatus.active }],
    [8, { id: 8, role: Role.member, status: UserStatus.inactive }],
    [9, { id: 9, role: Role.member, status: UserStatus.suspended }],
    [10, { id: 10, role: Role.member, status: UserStatus.active }],
  ]);
  const checkIns = new Map<string, Record<string, unknown>>();

  const prismaMock = {
    user: {
      findUnique: vi.fn(async ({ where, select }: any) => {
        const user = users.get(where.id);
        if (!user) return null;
        if (!select) return user;
        return Object.fromEntries(
          Object.entries(select)
            .filter(([, included]) => included)
            .map(([key]) => [
              key,
              (user as unknown as Record<string, unknown>)[key],
            ]),
        );
      }),
      findFirst: vi.fn(async ({ where, select }: any) => {
        const user = users.get(where.id);
        if (!user || user.role !== where.role) return null;
        if (!select) return user;
        return Object.fromEntries(
          Object.entries(select)
            .filter(([, included]) => included)
            .map(([key]) => [
              key,
              (user as unknown as Record<string, unknown>)[key],
            ]),
        );
      }),
    },
    checkIn: {
      create: vi.fn(async ({ data }: any) => {
        const key = `${data.memberId}:${data.localDate.toISOString().slice(0, 10)}`;
        if (checkIns.has(key)) {
          throw new Prisma.PrismaClientKnownRequestError(
            'Unique constraint failed',
            {
              code: 'P2002',
              clientVersion: '7.10.1',
              meta: { target: ['memberId', 'localDate'] },
            },
          );
        }
        const record = {
          id: checkIns.size + 1,
          ...data,
        };
        checkIns.set(key, record);
        return record;
      }),
    },
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CheckInsTestModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();
    jwt = app.get(JwtService);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    checkIns.clear();
  });

  async function tokenFor(id: number, role: Role): Promise<string> {
    return jwt.signAsync({ sub: id, role });
  }

  it('registra check-in para membro e admin, sem expor dados sensíveis', async () => {
    const memberToken = await tokenFor(7, Role.member);
    const memberResponse = await request(app.getHttpServer())
      .post('/api/v1/check-ins')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(201);

    expect(memberResponse.body).toMatchObject({
      id: 1,
      memberId: 7,
    });
    expect(memberResponse.body.localDate).toBe(
      getSaoPauloLocalDate(
        new Date(memberResponse.body.checkedInAt),
      ).toISOString(),
    );
    expect(memberResponse.text).not.toContain('passwordHash');
    expect(memberResponse.text).not.toContain('token');

    const adminToken = await tokenFor(1, Role.admin);
    await request(app.getHttpServer())
      .post('/api/v1/check-ins')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ memberId: 10 })
      .expect(201);
  });

  it('retorna 409 para check-in duplicado no mesmo dia local', async () => {
    const token = await tokenFor(7, Role.member);

    await request(app.getHttpServer())
      .post('/api/v1/check-ins')
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/api/v1/check-ins')
      .set('Authorization', `Bearer ${token}`)
      .expect(409);

    expect(response.body).toMatchObject({ code: 'CONFLICT' });
    expect(response.body.requestId).toBeTruthy();
  });

  it('rejeita trainer, id de outro membro e administrador sem memberId', async () => {
    const trainerToken = await tokenFor(2, Role.trainer);
    const memberToken = await tokenFor(7, Role.member);
    const adminToken = await tokenFor(1, Role.admin);

    await request(app.getHttpServer())
      .post('/api/v1/check-ins')
      .set('Authorization', `Bearer ${trainerToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .post('/api/v1/check-ins')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ memberId: 9 })
      .expect(403);

    await request(app.getHttpServer())
      .post('/api/v1/check-ins')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);

    expect(prismaMock.checkIn.create).not.toHaveBeenCalled();
  });

  it('retorna 404 para membro inexistente e 422 para membros inativos ou suspensos', async () => {
    const adminToken = await tokenFor(1, Role.admin);

    await request(app.getHttpServer())
      .post('/api/v1/check-ins')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ memberId: 999 })
      .expect(404);

    for (const memberId of [8, 9]) {
      const response = await request(app.getHttpServer())
        .post('/api/v1/check-ins')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ memberId })
        .expect(422);

      expect(response.body.code).toBe('UNPROCESSABLE_ENTITY');
    }

    expect(prismaMock.checkIn.create).not.toHaveBeenCalled();
  });

  afterAll(async () => {
    if (app) await app.close();
  });
});
