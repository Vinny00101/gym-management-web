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
import {
  DivisionType,
  Role,
  UserStatus,
} from '../src/generated/prisma/enums.js';
import { PrismaModule } from '../src/infra/database/prisma.module.js';
import { PrismaService } from '../src/infra/database/prisma.service.js';
import { WorkoutPlansModule } from '../src/modules/workout-plans/workout-plans.module.js';
import { AuthGuardsModule } from '../src/shared/identity/auth-guards.module.js';
import { SecurityEventService } from '../src/shared/security/security-event.service.js';
import { RequestIdMiddleware } from '../src/shared/middleware/request-id.middleware.js';

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
    WorkoutPlansModule,
    CheckInsModule,
  ],
})
class PartTwoFlowTestModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}

describe('Part 2 complete flow (e2e)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;
  let securityEvents: SecurityEventService;

  type TestUser = {
    id: number;
    name: string;
    role: Role;
    status: UserStatus;
    instructorId: number | null;
    activePlanId: number | null;
    activePlanAssignedAt: Date | null;
  };
  type TestCheckIn = {
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
        name: 'Admin',
        role: Role.admin,
        status: UserStatus.active,
        instructorId: null,
        activePlanId: null,
        activePlanAssignedAt: null,
      },
    ],
    [
      2,
      {
        id: 2,
        name: 'Instrutor',
        role: Role.trainer,
        status: UserStatus.active,
        instructorId: null,
        activePlanId: null,
        activePlanAssignedAt: null,
      },
    ],
    [
      3,
      {
        id: 3,
        name: 'Outro instrutor',
        role: Role.trainer,
        status: UserStatus.active,
        instructorId: null,
        activePlanId: null,
        activePlanAssignedAt: null,
      },
    ],
    [
      10,
      {
        id: 10,
        name: 'Ana',
        role: Role.member,
        status: UserStatus.active,
        instructorId: 2,
        activePlanId: null,
        activePlanAssignedAt: null,
      },
    ],
    [
      11,
      {
        id: 11,
        name: 'Bruno',
        role: Role.member,
        status: UserStatus.active,
        instructorId: 3,
        activePlanId: null,
        activePlanAssignedAt: null,
      },
    ],
  ]);
  const checkIns: TestCheckIn[] = [];
  let plan: any;
  let nextExerciseId = 200;

  function selectUser(user: TestUser, select: Record<string, unknown>) {
    return Object.fromEntries(
      Object.entries(select)
        .filter(([, included]) => included === true)
        .map(([key]) => [
          key,
          (user as unknown as Record<string, unknown>)[key],
        ])
        .filter(([, value]) => value !== undefined),
    );
  }

  function matchingCheckIns(where: any): TestCheckIn[] {
    return checkIns
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

  const prismaMock: any = {
    user: {
      findUnique: vi.fn(async ({ where, select }: any) => {
        const user = users.get(where.id);
        if (!user) return null;
        return select ? selectUser(user, select) : user;
      }),
      findFirst: vi.fn(async ({ where, select }: any) => {
        const user = users.get(where.id);
        if (!user || (where.role && user.role !== where.role)) return null;
        return select ? selectUser(user, select) : user;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const user = users.get(where.id);
        if (!user) return null;
        const updated = { ...user, ...data };
        users.set(user.id, updated);
        return updated;
      }),
    },
    workoutPlan: {
      create: vi.fn(async ({ data }: any) => {
        plan = {
          id: 100,
          name: data.name,
          objective: data.objective,
          trainerId: data.trainerId,
          memberId: data.memberId,
          createdAt: new Date('2026-11-26T12:00:00.000Z'),
          updatedAt: new Date('2026-11-26T12:00:00.000Z'),
          divisions: data.divisions.create.map(
            (division: Record<string, unknown>, index: number) => ({
              id: 101 + index,
              planId: 100,
              ...division,
              exercises: [],
            }),
          ),
        };
        return plan;
      }),
      findUnique: vi.fn(async ({ where, select }: any) => {
        if (!plan || where.id !== plan.id) return null;
        if (!select) return plan;
        const result: Record<string, unknown> = {};
        if (select.id) result.id = plan.id;
        if (select.trainerId) result.trainerId = plan.trainerId;
        if (select.memberId) result.memberId = plan.memberId;
        if (select.member) {
          const member = users.get(plan.memberId);
          result.member = member
            ? {
                id: member.id,
                instructorId: member.instructorId,
              }
            : null;
        }
        return result;
      }),
    },
    workoutDivision: {
      count: vi.fn(async () => plan?.divisions.length ?? 0),
      findUnique: vi.fn(async ({ where }: any) => {
        const division = plan?.divisions.find(
          (candidate: any) => candidate.id === where.id,
        );
        return division ? { id: division.id, planId: division.planId } : null;
      }),
    },
    exercise: {
      count: vi.fn(async ({ where }: any) => {
        const division = plan?.divisions.find(
          (candidate: any) => candidate.id === where.divisionId,
        );
        return division?.exercises.length ?? 0;
      }),
      create: vi.fn(async ({ data }: any) => {
        const exercise = { id: nextExerciseId++, ...data };
        const division = plan?.divisions.find(
          (candidate: any) => candidate.id === data.divisionId,
        );
        division?.exercises.push(exercise);
        return exercise;
      }),
    },
    checkIn: {
      create: vi.fn(async ({ data }: any) => {
        const duplicate = checkIns.some(
          (record) =>
            record.memberId === data.memberId &&
            record.localDate.getTime() === data.localDate.getTime(),
        );
        if (duplicate) {
          throw new Prisma.PrismaClientKnownRequestError(
            'Unique constraint failed',
            {
              code: 'P2002',
              clientVersion: '7.10.1',
              meta: { target: ['memberId', 'localDate'] },
            },
          );
        }
        const record = { id: checkIns.length + 1, ...data };
        checkIns.push(record);
        return record;
      }),
      findMany: vi.fn(async ({ where, skip, take }: any) =>
        matchingCheckIns(where).slice(skip, skip + take),
      ),
      count: vi.fn(async ({ where }: any) => matchingCheckIns(where).length),
    },
    $transaction: vi.fn((operation: any) =>
      Array.isArray(operation) ? Promise.all(operation) : operation(prismaMock),
    ),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PartTwoFlowTestModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();
    jwt = app.get(JwtService);
    securityEvents = app.get(SecurityEventService);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    checkIns.length = 0;
    plan = undefined;
    nextExerciseId = 200;
    for (const [id, user] of users) {
      users.set(id, {
        ...user,
        activePlanId: null,
        activePlanAssignedAt: null,
      });
    }
  });

  async function tokenFor(id: number, role: Role): Promise<string> {
    return jwt.signAsync({ sub: id, role });
  }

  it('executa criação, atribuição, consulta, check-in e histórico por papel', async () => {
    const trainerToken = await tokenFor(2, Role.trainer);
    const memberToken = await tokenFor(10, Role.member);
    const adminToken = await tokenFor(1, Role.admin);

    const createdPlan = await request(app.getHttpServer())
      .post('/api/v1/workout-plans')
      .set('Authorization', `Bearer ${trainerToken}`)
      .send({
        name: 'Treino A',
        objective: 'Hipertrofia',
        memberId: 10,
        divisions: [{ name: 'Peitoral', type: DivisionType.day }],
      })
      .expect(201);
    expect(createdPlan.body.id).toBe(100);

    await request(app.getHttpServer())
      .post('/api/v1/workout-plans/100/divisions/101/exercises')
      .set('Authorization', `Bearer ${trainerToken}`)
      .send({ name: 'Supino reto', sets: 4, repetitions: 10 })
      .expect(201);

    const assignment = await request(app.getHttpServer())
      .post('/api/v1/workout-plans/100/assign')
      .set('Authorization', `Bearer ${trainerToken}`)
      .send({ memberId: 10 })
      .expect(200);
    expect(assignment.body).toMatchObject({ planId: 100, memberId: 10 });

    const currentPlan = await request(app.getHttpServer())
      .get('/api/v1/members/10/workout-plan')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);
    expect(currentPlan.body.divisions[0].exercises[0]).toMatchObject({
      name: 'Supino reto',
      sets: 4,
      repetitions: 10,
    });
    expect(currentPlan.text).not.toContain('passwordHash');

    const checkIn = await request(app.getHttpServer())
      .post('/api/v1/check-ins')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(201);
    expect(checkIn.body.memberId).toBe(10);
    expect(checkIn.text).not.toContain('token');

    for (const token of [adminToken, trainerToken, memberToken]) {
      const history = await request(app.getHttpServer())
        .get('/api/v1/check-ins')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(history.body.total).toBe(1);
      expect(history.body.items[0]).toMatchObject({
        id: 1,
        memberId: 10,
      });
      expect(history.text).not.toContain('passwordHash');
      expect(history.text).not.toContain('token');
    }

    const denied = vi.spyOn(securityEvents, 'accessDenied');
    const otherMemberPlan = await request(app.getHttpServer())
      .get('/api/v1/members/11/workout-plan')
      .set('Authorization', `Bearer ${trainerToken}`)
      .expect(403);
    expect(otherMemberPlan.body).toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(otherMemberPlan.body.requestId).toBeTruthy();
    expect(denied).toHaveBeenCalled();
  });

  it('publica no Swagger as oito rotas da Parte 2, seus papéis e códigos', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);
    const paths = response.body.paths;
    const expected = [
      [
        '/api/v1/workout-plans',
        'post',
        ['201', '400', '403', '404'],
        'trainer',
      ],
      [
        '/api/v1/workout-plans/{planId}/divisions',
        'post',
        ['201', '400', '403', '404'],
        'trainer',
      ],
      [
        '/api/v1/workout-plans/{planId}/divisions/{divisionId}/exercises',
        'post',
        ['201', '400', '403', '404'],
        'trainer',
      ],
      [
        '/api/v1/workout-plans/{planId}',
        'patch',
        ['200', '400', '403', '404'],
        'trainer',
      ],
      [
        '/api/v1/workout-plans/{planId}/assign',
        'post',
        ['200', '400', '403', '404'],
        'trainer',
      ],
      [
        '/api/v1/members/{memberId}/workout-plan',
        'get',
        ['200', '403', '404'],
        'member',
      ],
      [
        '/api/v1/check-ins',
        'post',
        ['201', '400', '403', '404', '409', '422'],
        'admin',
      ],
      ['/api/v1/check-ins', 'get', ['200', '400', '403'], 'admin'],
    ] as const;

    for (const [path, method, statuses, role] of expected) {
      const operation = paths[path]?.[method];
      expect(operation, `${method.toUpperCase()} ${path}`).toBeDefined();
      expect(operation.description).toContain(role);
      for (const status of statuses) {
        expect(operation.responses[status]).toBeDefined();
      }
    }
  });

  afterAll(async () => {
    if (app) await app.close();
  });
});
