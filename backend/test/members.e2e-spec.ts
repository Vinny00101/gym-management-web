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
class MembersTestModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}

describe('Members (e2e)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;

  const users = new Map([
    [
      1,
      {
        id: 1,
        name: 'Admin',
        email: 'admin@academia.com',
        passwordHash: 'hash',
        role: Role.admin,
        status: UserStatus.active,
      },
    ],
    [
      2,
      {
        id: 2,
        name: 'Instrutor',
        email: 'trainer@academia.com',
        passwordHash: 'hash',
        role: Role.trainer,
        status: UserStatus.active,
      },
    ],
  ]);

  type MemberCreateArgs = {
    data: {
      name: string;
      email: string;
      passwordHash: string;
      role: Role;
      status: UserStatus;
    };
    select: Record<string, boolean>;
  };

  const prismaMock = {
    user: {
      findUnique: vi.fn(async ({ where, select }: {
        where: { email?: string; id?: number };
        select?: Record<string, boolean>;
      }) => {
        const user = where.id !== undefined
          ? [...users.values()].find((item) => item.id === where.id)
          : [...users.values()].find((item) => item.email === where.email);
        if (!user) return null;
        if (!select) return user;
        return Object.fromEntries(
          Object.entries(select).filter(([, included]) => included)
            .map(([key]) => [key, (user as unknown as Record<string, unknown>)[key]])
            .filter(([, value]) => value !== undefined),
        );
      }),
      create: vi.fn(async ({ data, select }: MemberCreateArgs) => {
        const created = {
          id: users.size + 1,
          name: data.name,
          email: data.email,
          passwordHash: data.passwordHash,
          role: data.role,
          status: data.status,
        };
        users.set(created.id, created);
        return Object.fromEntries(
          Object.entries(select).filter(([, included]) => included)
            .map(([key]) => [key, (created as unknown as Record<string, unknown>)[key]])
            .filter(([, value]) => value !== undefined),
        );
      }),
    },
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MembersTestModule],
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

  it('permite que admin cadastre membro ativo sem expor senha', async () => {
    const token = await tokenFor(1, Role.admin);
    const response = await request(app.getHttpServer())
      .post('/api/v1/members')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Ana Souza',
        email: 'Ana@Academia.com',
        password: 'Senha@123',
        status: UserStatus.suspended,
      })
      .expect(201);

    expect(response.body).toEqual({
      id: expect.any(Number),
      name: 'Ana Souza',
      email: 'ana@academia.com',
      role: Role.member,
      status: UserStatus.active,
    });
    expect(JSON.stringify(response.body)).not.toContain('password');
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');

    const createCall = prismaMock.user.create.mock.calls[0]?.[0];
    expect(createCall.data.passwordHash).toBeDefined();
    expect(createCall.data.passwordHash).not.toBe('Senha@123');
  });

  it('retorna 409 para email repetido', async () => {
    const token = await tokenFor(1, Role.admin);

    await request(app.getHttpServer())
      .post('/api/v1/members')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Outro Admin',
        email: 'admin@academia.com',
        password: 'Senha@123',
      })
      .expect(409);
  });

  it('retorna 403 para usuario que nao seja admin', async () => {
    const token = await tokenFor(2, Role.trainer);

    await request(app.getHttpServer())
      .post('/api/v1/members')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Novo Membro',
        email: 'novo@academia.com',
        password: 'Senha@123',
      })
      .expect(403);
  });

  afterAll(async () => {
    await app.close();
  });
});
