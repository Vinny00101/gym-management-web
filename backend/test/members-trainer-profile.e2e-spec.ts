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
import { MembersModule } from '../src/modules/members/members.module.js';
import { Role, UserStatus } from '../src/generated/prisma/enums.js';
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
    MembersModule,
  ],
})
class MembersTrainerProfileTestModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}

describe('Trainer association and profile (e2e)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;

  const users = [
    { id: 1, name: 'Admin', email: 'admin@academia.com', role: Role.admin, status: UserStatus.active },
    { id: 2, name: 'Carlos', email: 'carlos@academia.com', role: Role.trainer, status: UserStatus.active },
    { id: 3, name: 'Ana', email: 'ana@academia.com', role: Role.member, status: UserStatus.active, instructorId: null as number | null },
  ];

  const prismaMock = {
    user: {
      findUnique: vi.fn(async ({ where, select }: {
        where: { id: number };
        select?: Record<string, boolean>;
      }) => {
        const user = users.find((item) => item.id === where.id);
        if (!user) return null;
        if (!select) return user;
        return user;
      }),
      findFirst: vi.fn(async ({ where }: {
        where: { id: number; role: Role };
      }) => {
        const user = users.find(
          (item) => item.id === where.id && item.role === where.role,
        );
        if (!user) return null;
        if (user.role !== Role.member) return user;
        const trainer = users.find(
          (item) => item.id === ('instructorId' in user ? user.instructorId : null),
        );
        return {
          ...user,
          instructor: trainer
            ? { id: trainer.id, name: trainer.name, email: trainer.email }
            : null,
        };
      }),
      update: vi.fn(async ({ where, data }: {
        where: { id: number };
        data: { instructorId: number };
      }) => {
        const member = users.find((item) => item.id === where.id);
        if (!member) return null;
        member.instructorId = data.instructorId;
        const trainer = users.find((item) => item.id === data.instructorId);
        return {
          id: member.id,
          name: member.name,
          email: member.email,
          role: member.role,
          status: member.status,
          instructor: trainer ? { id: trainer.id, name: trainer.name, email: trainer.email } : null,
        };
      }),
    },
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MembersTrainerProfileTestModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();
    jwt = app.get(JwtService);
  });

  async function tokenFor(id: number, role: Role): Promise<string> {
    return jwt.signAsync({ sub: id, role });
  }

  beforeEach(() => vi.clearAllMocks());

  it('admin associa instrutor ao membro', async () => {
    const token = await tokenFor(1, Role.admin);
    const response = await request(app.getHttpServer())
      .put('/api/v1/members/3/trainer')
      .set('Authorization', `Bearer ${token}`)
      .send({ trainerId: 2 })
      .expect(200);

    expect(response.body.instructor).toEqual({
      id: 2,
      name: 'Carlos',
      email: 'carlos@academia.com',
    });
  });

  it('id que nao pertence a instrutor retorna 422', async () => {
    const token = await tokenFor(1, Role.admin);
    await request(app.getHttpServer())
      .put('/api/v1/members/3/trainer')
      .set('Authorization', `Bearer ${token}`)
      .send({ trainerId: 1 })
      .expect(422);
  });

  it('membro acessa proprio perfil com instrutor responsavel', async () => {
    const token = await tokenFor(3, Role.member);
    const response = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.id).toBe(3);
    expect(response.body.instructor).toBeTruthy();
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
  });

  it('instrutor nao acessa /me', async () => {
    const token = await tokenFor(2, Role.trainer);
    await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('membro inexistente retorna 404 ao associar instrutor', async () => {
    const token = await tokenFor(1, Role.admin);
    await request(app.getHttpServer())
      .put('/api/v1/members/999/trainer')
      .set('Authorization', `Bearer ${token}`)
      .send({ trainerId: 2 })
      .expect(404);
  });

  afterAll(async () => {
    await app.close();
  });
});
