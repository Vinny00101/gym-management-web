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
import { AuthGuardsModule } from '../src/shared/identity/auth-guards.module.js';
import { WorkoutPlansModule } from '../src/modules/workout-plans/workout-plans.module.js';
import {
  DivisionType,
  Role,
  UserStatus,
} from '../src/generated/prisma/enums.js';
import { RequestIdMiddleware } from '../src/shared/middleware/request-id.middleware.js';
import { PrismaModule } from '../src/infra/database/prisma.module.js';
import { PrismaService } from '../src/infra/database/prisma.service.js';

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
  ],
})
class WorkoutPlansTestModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}

describe('Workout plans (e2e)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;

  const users = new Map([
    [
      1,
      {
        id: 1,
        name: 'Admin',
        role: Role.admin,
        status: UserStatus.active,
        instructorId: null,
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
      },
    ],
  ]);

  const prismaMock = {
    user: {
      findUnique: vi.fn(
        async ({
          where,
          select,
        }: {
          where: { id?: number };
          select?: Record<string, boolean>;
        }) => {
          const user = where.id === undefined ? undefined : users.get(where.id);
          if (!user) return null;
          if (!select) return user;
          return Object.fromEntries(
            Object.entries(select)
              .filter(([, included]) => included)
              .map(([key]) => [
                key,
                (user as unknown as Record<string, unknown>)[key],
              ])
              .filter(([, value]) => value !== undefined),
          );
        },
      ),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    workoutPlan: {
      findUnique: vi.fn(async ({ where }: any) =>
        where.id === 100 ? { id: 100, member: users.get(10) } : null,
      ),
      create: vi.fn(async ({ data }: any) => ({
        id: 100,
        name: data.name,
        objective: data.objective,
        trainerId: data.trainerId,
        memberId: data.memberId,
        divisions: data.divisions.create.map(
          (division: Record<string, unknown>, index: number) => ({
            id: index + 1,
            planId: 100,
            ...division,
          }),
        ),
        createdAt: new Date('2026-11-26T12:00:00.000Z'),
        updatedAt: new Date('2026-11-26T12:00:00.000Z'),
      })),
    },
    workoutDivision: {
      count: vi.fn(async () => 1),
      create: vi.fn(async ({ data }: any) => ({ id: 101, ...data })),
      findUnique: vi.fn(async ({ where }: any) =>
        where.id === 101 ? { id: 101, planId: 100 } : null,
      ),
    },
    exercise: {
      count: vi.fn(async () => 2),
      create: vi.fn(async ({ data }: any) => ({ id: 201, ...data })),
    },
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  };

  const validBody = {
    name: 'Treino A - Peitoral',
    objective: 'Hipertrofia',
    memberId: 10,
    divisions: [
      { name: 'Segunda - Peitoral', type: DivisionType.day, order: 1 },
    ],
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [WorkoutPlansTestModule],
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
  });

  async function tokenFor(id: number, role: Role): Promise<string> {
    return jwt.signAsync({ sub: id, role });
  }

  it('retorna 201 com o plano e as divisões criadas', async () => {
    const token = await tokenFor(2, Role.trainer);

    const response = await request(app.getHttpServer())
      .post('/api/v1/workout-plans')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody)
      .expect(201);

    expect(response.body).toEqual({
      id: 100,
      name: validBody.name,
      objective: validBody.objective,
      trainerId: 2,
      memberId: 10,
      divisions: [
        {
          id: 1,
          planId: 100,
          name: 'Segunda - Peitoral',
          type: DivisionType.day,
          order: 1,
        },
      ],
      createdAt: '2026-11-26T12:00:00.000Z',
      updatedAt: '2026-11-26T12:00:00.000Z',
    });

    const createCall = prismaMock.workoutPlan.create.mock.calls[0]?.[0];
    expect(createCall.data.trainerId).toBe(2);
    expect(createCall.data.memberId).toBe(10);
    expect(createCall.data.divisions.create).toHaveLength(1);
  });

  it('retorna 201 com objective vazio e order sequencial quando omitidos', async () => {
    const token = await tokenFor(2, Role.trainer);

    const response = await request(app.getHttpServer())
      .post('/api/v1/workout-plans')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Treino B',
        memberId: 10,
        divisions: [
          { name: 'Peitoral', type: DivisionType.muscleGroup },
          { name: 'Costas', type: DivisionType.muscleGroup },
        ],
      })
      .expect(201);

    expect(response.body.objective).toBe('');
    expect(
      response.body.divisions.map((item: { order: number }) => item.order),
    ).toEqual([1, 2]);
  });

  it('retorna 403 para admin e para member', async () => {
    const adminToken = await tokenFor(1, Role.admin);
    const memberToken = await tokenFor(10, Role.member);

    await request(app.getHttpServer())
      .post('/api/v1/workout-plans')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validBody)
      .expect(403);

    await request(app.getHttpServer())
      .post('/api/v1/workout-plans')
      .set('Authorization', `Bearer ${memberToken}`)
      .send(validBody)
      .expect(403);

    expect(prismaMock.workoutPlan.create).not.toHaveBeenCalled();
  });

  it('retorna 403 para instrutor de outro membro', async () => {
    const token = await tokenFor(2, Role.trainer);

    await request(app.getHttpServer())
      .post('/api/v1/workout-plans')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validBody, memberId: 11 })
      .expect(403);

    expect(prismaMock.workoutPlan.create).not.toHaveBeenCalled();
  });

  it('retorna 400 com details para divisions vazia', async () => {
    const token = await tokenFor(2, Role.trainer);

    const response = await request(app.getHttpServer())
      .post('/api/v1/workout-plans')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validBody, divisions: [] })
      .expect(400);

    expect(response.body.code).toBe('BAD_REQUEST');
    expect(response.body.details).toEqual(
      expect.arrayContaining([expect.stringContaining('divisions')]),
    );
    expect(prismaMock.workoutPlan.create).not.toHaveBeenCalled();
  });

  it('retorna 400 para divisão com tipo inválido', async () => {
    const token = await tokenFor(2, Role.trainer);

    await request(app.getHttpServer())
      .post('/api/v1/workout-plans')
      .set('Authorization', `Bearer ${token}`)
      .send({
        ...validBody,
        divisions: [{ name: 'Peitoral', type: 'invalid' }],
      })
      .expect(400);

    expect(prismaMock.workoutPlan.create).not.toHaveBeenCalled();
  });

  it('retorna 400 para campo extra no corpo', async () => {
    const token = await tokenFor(2, Role.trainer);

    await request(app.getHttpServer())
      .post('/api/v1/workout-plans')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validBody, activePlanId: 999 })
      .expect(400);

    expect(prismaMock.workoutPlan.create).not.toHaveBeenCalled();
  });

  it('retorna 404 para membro inexistente', async () => {
    const token = await tokenFor(2, Role.trainer);

    await request(app.getHttpServer())
      .post('/api/v1/workout-plans')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validBody, memberId: 999 })
      .expect(404);

    expect(prismaMock.workoutPlan.create).not.toHaveBeenCalled();
  });

  it('retorna 201 ao adicionar divisão ao plano', async () => {
    const token = await tokenFor(2, Role.trainer);

    const response = await request(app.getHttpServer())
      .post('/api/v1/workout-plans/100/divisions')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Costas', type: DivisionType.muscleGroup })
      .expect(201);

    expect(response.body).toMatchObject({
      planId: 100,
      name: 'Costas',
      type: DivisionType.muscleGroup,
      order: 2,
    });
  });

  it('retorna 201 ao adicionar exercício à divisão', async () => {
    const token = await tokenFor(2, Role.trainer);

    const response = await request(app.getHttpServer())
      .post('/api/v1/workout-plans/100/divisions/101/exercises')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Supino reto', sets: 3, repetitions: 12 })
      .expect(201);

    expect(response.body).toMatchObject({
      divisionId: 101,
      name: 'Supino reto',
      sets: 3,
      repetitions: 12,
      order: 3,
    });
  });

  it('retorna 400 para séries ou repetições inválidas', async () => {
    const token = await tokenFor(2, Role.trainer);

    await request(app.getHttpServer())
      .post('/api/v1/workout-plans/100/divisions/101/exercises')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Supino', sets: 0, repetitions: 1.5 })
      .expect(400);

    expect(prismaMock.exercise.create).not.toHaveBeenCalled();
  });

  it('retorna 404 para divisão de outro plano', async () => {
    const token = await tokenFor(2, Role.trainer);

    await request(app.getHttpServer())
      .post('/api/v1/workout-plans/100/divisions/999/exercises')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Supino', sets: 3, repetitions: 12 })
      .expect(404);

    expect(prismaMock.exercise.create).not.toHaveBeenCalled();
  });

  it('retorna 403 para outro instrutor e para papel não autorizado', async () => {
    const trainerToken = await tokenFor(3, Role.trainer);
    const memberToken = await tokenFor(10, Role.member);

    await request(app.getHttpServer())
      .post('/api/v1/workout-plans/100/divisions/101/exercises')
      .set('Authorization', `Bearer ${trainerToken}`)
      .send({ name: 'Supino', sets: 3, repetitions: 12 })
      .expect(403);

    await request(app.getHttpServer())
      .post('/api/v1/workout-plans/100/divisions/101/exercises')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ name: 'Supino', sets: 3, repetitions: 12 })
      .expect(403);
  });

  afterAll(async () => {
    if (app) await app.close();
  });
});
