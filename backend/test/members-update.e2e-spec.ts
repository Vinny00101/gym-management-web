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
  ],
})
class MembersUpdateTestModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}

describe('Members update (e2e)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;

  const users = [
    { id: 1, name: 'Admin', email: 'admin@academia.com', role: Role.admin, status: UserStatus.active },
    { id: 2, name: 'Instrutor', email: 'trainer@academia.com', role: Role.trainer, status: UserStatus.active },
    { id: 3, name: 'Ana', email: 'ana@academia.com', role: Role.member, status: UserStatus.active },
  ];

  const prismaMock = {
    user: {
      findUnique: vi.fn(async ({ where, select }: {
        where: { email?: string; id?: number };
        select?: Record<string, boolean>;
      }) => {
        const user = where.id !== undefined
          ? users.find((item) => item.id === where.id)
          : users.find((item) => item.email === where.email);
        if (!user) return null;
        if (!select) return user;
        return Object.fromEntries(
          Object.entries(select).filter(([, included]) => included)
            .map(([key]) => [key, (user as unknown as Record<string, unknown>)[key]])
            .filter(([, value]) => value !== undefined),
        );
      }),
      findFirst: vi.fn(async ({ where }: { where: { id: number; role: Role } }) =>
        users.find((user) => user.id === where.id && user.role === where.role) ?? null,
      ),
      update: vi.fn(async ({ where, data, select }: {
        where: { id: number };
        data: Record<string, unknown>;
        select: Record<string, boolean>;
      }) => {
        const user = users.find((item) => item.id === where.id);
        if (!user) return null;
        Object.assign(user, data);
        return Object.fromEntries(
          Object.entries(select).filter(([, included]) => included)
            .map(([key]) => [key, (user as unknown as Record<string, unknown>)[key]])
            .filter(([, value]) => value !== undefined),
        );
      }),
    },
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MembersUpdateTestModule],
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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('admin atualiza dados pessoais', async () => {
    const token = await tokenFor(1, Role.admin);
    const response = await request(app.getHttpServer())
      .patch('/api/v1/members/3')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Ana Maria', email: 'ana.nova@academia.com' })
      .expect(200);

    expect(response.body).toMatchObject({
      id: 3,
      name: 'Ana Maria',
      email: 'ana.nova@academia.com',
      role: Role.member,
    });
  });

  it('admin atualiza situacao valida', async () => {
    const token = await tokenFor(1, Role.admin);
    const response = await request(app.getHttpServer())
      .patch('/api/v1/members/3/status')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: UserStatus.suspended })
      .expect(200);

    expect(response.body.status).toBe(UserStatus.suspended);
  });

  it('rejeita situacao invalida', async () => {
    const token = await tokenFor(1, Role.admin);
    await request(app.getHttpServer())
      .patch('/api/v1/members/3/status')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'blocked' })
      .expect(400);
  });

  it('membro inexistente retorna 404', async () => {
    const token = await tokenFor(1, Role.admin);
    await request(app.getHttpServer())
      .patch('/api/v1/members/999/status')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: UserStatus.inactive })
      .expect(404);
  });

  it('instrutor recebe 403', async () => {
    const token = await tokenFor(2, Role.trainer);
    await request(app.getHttpServer())
      .patch('/api/v1/members/3/status')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: UserStatus.inactive })
      .expect(403);
  });

  afterAll(async () => {
    await app.close();
  });
});
