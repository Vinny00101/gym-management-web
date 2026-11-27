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
import { setupApp } from '../src/app/app.config.js';
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

  type TestUser = {
    id: number;
    role: Role;
    status: UserStatus;
    instructorId: number | null;
  };
  type CheckInRecord = {
    id: number;
    memberId: number;
    checkedInAt: Date;
    localDate: Date;
  };
  const users = new Map<number, TestUser>([
    [
      1,
      {
        id: 1,
        role: Role.admin,
        status: UserStatus.active,
        instructorId: null,
      },
    ],
    [
      2,
      {
        id: 2,
        role: Role.trainer,
        status: UserStatus.active,
        instructorId: null,
      },
    ],
    [
      3,
      {
        id: 3,
        role: Role.trainer,
        status: UserStatus.active,
        instructorId: null,
      },
    ],
    [
      7,
      { id: 7, role: Role.member, status: UserStatus.active, instructorId: 2 },
    ],
    [
      8,
      {
        id: 8,
        role: Role.member,
        status: UserStatus.inactive,
        instructorId: 2,
      },
    ],
    [
      9,
      {
        id: 9,
        role: Role.member,
        status: UserStatus.suspended,
        instructorId: 3,
      },
    ],
    [
      10,
      { id: 10, role: Role.member, status: UserStatus.active, instructorId: 3 },
    ],
  ]);
  const checkIns = new Map<string, CheckInRecord>();

  function matchingCheckIns(where: any): CheckInRecord[] {
    return [...checkIns.values()]
      .filter((record) => {
        if (
          where.memberId !== undefined &&
          record.memberId !== where.memberId
        ) {
          return false;
        }
        if (
          where.member?.instructorId !== undefined &&
          users.get(record.memberId)?.instructorId !== where.member.instructorId
        ) {
          return false;
        }
        if (where.localDate?.gte && record.localDate < where.localDate.gte) {
          return false;
        }
        if (where.localDate?.lte && record.localDate > where.localDate.lte) {
          return false;
        }
        return true;
      })
      .sort(
        (left, right) =>
          right.checkedInAt.getTime() - left.checkedInAt.getTime(),
      );
  }

  function seedCheckIn(record: CheckInRecord): void {
    checkIns.set(
      `${record.memberId}:${record.localDate.toISOString()}`,
      record,
    );
  }

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
      findMany: vi.fn(async ({ where, skip, take }: any) =>
        matchingCheckIns(where).slice(skip, skip + take),
      ),
      count: vi.fn(async ({ where }: any) => matchingCheckIns(where).length),
    },
    $transaction: vi.fn(async (queries: Promise<unknown>[]) =>
      Promise.all(queries),
    ),
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

  it('filtra histórico por papel, membro, período e paginação', async () => {
    const today = getSaoPauloLocalDate(new Date());
    const previousDay = new Date(today);
    previousDay.setUTCDate(previousDay.getUTCDate() - 1);
    const oldDay = new Date(today);
    oldDay.setUTCDate(oldDay.getUTCDate() - 35);
    const noon = (date: Date) => new Date(date.getTime() + 12 * 60 * 60 * 1000);

    seedCheckIn({
      id: 1,
      memberId: 7,
      checkedInAt: noon(today),
      localDate: today,
    });
    seedCheckIn({
      id: 2,
      memberId: 7,
      checkedInAt: noon(previousDay),
      localDate: previousDay,
    });
    seedCheckIn({
      id: 3,
      memberId: 10,
      checkedInAt: noon(today),
      localDate: today,
    });
    seedCheckIn({
      id: 4,
      memberId: 10,
      checkedInAt: noon(oldDay),
      localDate: oldDay,
    });

    const memberToken = await tokenFor(7, Role.member);
    const memberResponse = await request(app.getHttpServer())
      .get('/api/v1/check-ins')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);
    expect(memberResponse.body.total).toBe(2);
    expect(
      memberResponse.body.items.every((item: any) => item.memberId === 7),
    ).toBe(true);

    const trainerToken = await tokenFor(2, Role.trainer);
    const trainerResponse = await request(app.getHttpServer())
      .get('/api/v1/check-ins')
      .set('Authorization', `Bearer ${trainerToken}`)
      .expect(200);
    expect(trainerResponse.body.total).toBe(2);
    expect(
      trainerResponse.body.items.every((item: any) => item.memberId === 7),
    ).toBe(true);

    const adminToken = await tokenFor(1, Role.admin);
    const adminResponse = await request(app.getHttpServer())
      .get('/api/v1/check-ins?page=2&pageSize=1')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(adminResponse.body).toMatchObject({
      total: 3,
      page: 2,
      pageSize: 1,
    });
    expect(adminResponse.body.items).toHaveLength(1);

    const todayString = today.toISOString().slice(0, 10);
    const periodResponse = await request(app.getHttpServer())
      .get(
        `/api/v1/check-ins?memberId=10&from=${todayString}&to=${todayString}`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(periodResponse.body.total).toBe(1);
    expect(periodResponse.body.items[0].memberId).toBe(10);
  });

  it('nega filtros de membro alheio e intervalo invertido', async () => {
    const memberToken = await tokenFor(7, Role.member);
    const trainerToken = await tokenFor(2, Role.trainer);
    const adminToken = await tokenFor(1, Role.admin);

    await request(app.getHttpServer())
      .get('/api/v1/check-ins?memberId=10')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .get('/api/v1/check-ins?memberId=10')
      .set('Authorization', `Bearer ${trainerToken}`)
      .expect(403);

    const reversed = await request(app.getHttpServer())
      .get('/api/v1/check-ins?from=2026-11-27&to=2026-11-26')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
    expect(reversed.body.code).toBe('BAD_REQUEST');
  });

  afterAll(async () => {
    if (app) await app.close();
  });
});
