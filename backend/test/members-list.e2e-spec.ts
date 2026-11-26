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
class MembersListTestModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}

describe('Members listing (e2e)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;

  const users = [
    { id: 1, name: 'Admin', email: 'admin@academia.com', role: Role.admin, status: UserStatus.active },
    { id: 2, name: 'Treinador', email: 'trainer@academia.com', role: Role.trainer, status: UserStatus.active },
    { id: 3, name: 'Ana', email: 'ana@academia.com', role: Role.member, status: UserStatus.active, instructorId: 2 },
    { id: 4, name: 'Bia', email: 'bia@academia.com', role: Role.member, status: UserStatus.suspended, instructorId: 99 },
  ];

  const prismaMock = {
    user: {
      findUnique: vi.fn(async ({ where }: { where: { id: number } }) =>
        users.find((user) => user.id === where.id) ?? null,
      ),
      findMany: vi.fn(async ({ where, skip, take }: {
        where: { status?: UserStatus; instructorId?: number };
        skip: number;
        take: number;
      }) => {
        const rows = users.filter((user) =>
          user.role === Role.member &&
          (!where.status || user.status === where.status) &&
          (where.instructorId === undefined || ('instructorId' in user && user.instructorId === where.instructorId)),
        );
        return rows.slice(skip, skip + take).map(({ id, name, email, role, status }) =>
          ({ id, name, email, role, status }),
        );
      }),
      count: vi.fn(async ({ where }: {
        where: { status?: UserStatus; instructorId?: number };
      }) => users.filter((user) =>
        user.role === Role.member &&
        (!where.status || user.status === where.status) &&
        (where.instructorId === undefined || ('instructorId' in user && user.instructorId === where.instructorId)),
      ).length),
      findFirst: vi.fn(async ({ where }: {
        where: { id: number; role: Role };
      }) => {
        const member = users.find((user) => user.id === where.id && user.role === where.role);
        return member ?? null;
      }),
    },
    $transaction: vi.fn(async (queries: Promise<unknown>[]) => Promise.all(queries)),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MembersListTestModule],
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

  it('admin lista todos com filtro e paginacao', async () => {
    const token = await tokenFor(1, Role.admin);
    const response = await request(app.getHttpServer())
      .get('/api/v1/members?status=active&page=1&limit=10')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.total).toBe(1);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].name).toBe('Ana');
  });

  it('instrutor lista somente membros associados', async () => {
    const token = await tokenFor(2, Role.trainer);
    const response = await request(app.getHttpServer())
      .get('/api/v1/members')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.total).toBe(1);
    expect(response.body.data[0].id).toBe(3);
  });

  it('membro recebe 403 na listagem', async () => {
    const token = await tokenFor(3, Role.member);
    await request(app.getHttpServer())
      .get('/api/v1/members')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('instrutor recebe 404 ao buscar membro nao associado', async () => {
    const token = await tokenFor(2, Role.trainer);
    await request(app.getHttpServer())
      .get('/api/v1/members/4')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('limite acima de 100 recebe 400', async () => {
    const token = await tokenFor(1, Role.admin);
    await request(app.getHttpServer())
      .get('/api/v1/members?limit=101')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  afterAll(async () => {
    await app.close();
  });
});
