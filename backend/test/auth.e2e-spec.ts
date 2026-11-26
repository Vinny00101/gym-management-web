import {
  Controller,
  Get,
  INestApplication,
  MiddlewareConsumer,
  Module,
  NestModule,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { LoggerModule } from 'nestjs-pino';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { setupApp } from '../src/app/setup-app.js';
import { AuthGuardsModule } from '../src/auth-guards.module.js';
import type { AuthenticatedUser } from '../src/auth.types.js';
import { CurrentUser } from '../src/common/decorators/current-user.decorator.js';
import { Public } from '../src/common/decorators/public.decorator.js';
import { Roles } from '../src/common/decorators/roles.decorator.js';
import { hashPassword } from '../src/services/password.crypto.js';
import { REFRESH_COOKIE_NAME } from '../src/services/refresh-token.service.js';
import { Role, UserStatus } from '../src/generated/prisma/enums.js';
import { RequestIdMiddleware } from '../src/middleware/request-id.middleware.js';
import { PrismaModule } from '../src/prisma/prisma.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

@Controller('protected')
class ProtectedTestController {
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  @Get('admin')
  @Roles(Role.admin)
  adminOnly() {
    return { ok: true };
  }

  @Get('public')
  @Public()
  publicRoute() {
    return { ok: true };
  }
}

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
  controllers: [ProtectedTestController],
})
class TestAppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  const storedTokens = new Map<string, { userId: number; expiresAt: Date; revokedAt: Date | null }>();

  const user = {
    id: 7,
    name: 'Ana',
    email: 'ana@example.com',
    passwordHash: '',
    role: Role.member,
    status: UserStatus.active as UserStatus,
  };

  const prismaMock = {
    user: {
      findUnique: vi.fn(async ({ where }: { where: { email?: string; id?: number } }) => {
        if (where.email !== undefined) {
          return where.email === user.email ? user : null;
        }
        return where.id === user.id ? user : null;
      }),
      findUniqueOrThrow: vi.fn(async () => user),
    },
    refreshToken: {
      create: vi.fn(async ({ data }: { data: { tokenHash: string; userId: number; expiresAt: Date } }) => {
        storedTokens.set(data.tokenHash, {
          userId: data.userId,
          expiresAt: data.expiresAt,
          revokedAt: null,
        });
        return { id: storedTokens.size, ...data };
      }),
      findUnique: vi.fn(async ({ where }: { where: { tokenHash: string } }) => {
        const stored = storedTokens.get(where.tokenHash);
        return stored ? { id: 1, tokenHash: where.tokenHash, user: { status: user.status }, ...stored } : null;
      }),
      updateMany: vi.fn(async ({ where, data }: { where: { tokenHash?: string; id?: number; revokedAt?: Date | null }; data: { revokedAt: Date } }) => {
        let count = 0;
        for (const [hash, stored] of storedTokens) {
          const matches =
            (where.tokenHash === undefined || where.tokenHash === hash) &&
            (where.id === undefined || where.id === 1) &&
            stored.revokedAt === null;
          if (matches) {
            stored.revokedAt = data.revokedAt;
            count += 1;
          }
        }
        return { count };
      }),
    },
    $transaction: vi.fn(async (callback: (client: unknown) => unknown) =>
      callback(prismaMock),
    ),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  };

  beforeAll(async () => {
    user.passwordHash = await hashPassword('Senha@123');
  });

  beforeEach(async () => {
    storedTokens.clear();
    user.status = UserStatus.active;
    user.role = Role.member;
    vi.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestAppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();
  });

  async function login(password = 'Senha@123') {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password });
    return response;
  }

  it('POST /auth/login retorna access token e cookie httpOnly', async () => {
    const response = await login();

    expect(response.status).toBe(200);
    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.expiresIn).toBe(900);
    expect(response.body.user).toEqual({
      id: user.id,
      name: user.name,
      role: Role.member,
    });
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
    expect(JSON.stringify(response.body)).not.toContain('Senha@123');

    const cookie = response.headers['set-cookie'][0];
    expect(cookie).toContain(`${REFRESH_COOKIE_NAME}=`);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Path=/auth');
    expect(cookie).not.toContain('Secure');
  });

  it('retorna 401 com a mesma mensagem para e-mail inexistente e senha errada', async () => {
    const unknownEmail = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'nobody@example.com', password: 'Senha@123' });
    const wrongPassword = await login('senha-errada');

    for (const response of [unknownEmail, wrongPassword]) {
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        code: 'UNAUTHORIZED',
        message: 'E-mail ou senha inválidos',
      });
      expect(response.body.requestId).toBeDefined();
      expect(JSON.stringify(response.body)).not.toContain('Senha@123');
    }
  });

  it('nega login a membro suspenso', async () => {
    user.status = UserStatus.suspended;

    const response = await login();

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('E-mail ou senha inválidos');
  });

  it('exige token nas rotas sem @Public() e libera as marcadas', async () => {
    await request(app.getHttpServer()).get('/protected/me').expect(401);
    await request(app.getHttpServer()).get('/protected/public').expect(200);

    const { body } = await login();
    const me = await request(app.getHttpServer())
      .get('/protected/me')
      .set('Authorization', `Bearer ${body.accessToken}`)
      .expect(200);

    expect(me.body).toEqual({ id: user.id, role: Role.member });
  });

  it('bloqueia papel diferente do declarado em @Roles() com 403', async () => {
    const { body } = await login();

    const response = await request(app.getHttpServer())
      .get('/protected/admin')
      .set('Authorization', `Bearer ${body.accessToken}`);

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
  });

  it('POST /auth/refresh emite novo token e rotaciona o cookie', async () => {
    const { headers } = await login();
    const cookie = headers['set-cookie'][0];

    const refreshed = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', cookie)
      .expect(200);

    expect(refreshed.body.accessToken).toEqual(expect.any(String));
    const newCookie = refreshed.headers['set-cookie'][0];
    expect(newCookie).toContain(`${REFRESH_COOKIE_NAME}=`);
    expect(newCookie).not.toBe(cookie);
    expect(storedTokens.size).toBe(2);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', cookie)
      .expect(401);
  });

  it('POST /auth/logout revoga o token e limpa o cookie', async () => {
    const { headers } = await login();
    const cookie = headers['set-cookie'][0];

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', cookie)
      .expect(204);

    expect([...storedTokens.values()].every((token) => token.revokedAt !== null)).toBe(true);
    const cleared = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', cookie)
      .expect(401);
    expect(cleared.body.code).toBe('UNAUTHORIZED');
  });

  it('limita o login a 5 tentativas por minuto por IP', async () => {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await login('senha-errada');
      expect(response.status).toBe(401);
    }

    const blocked = await login('senha-errada');

    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe('TOO_MANY_REQUESTS');
  });

  afterEach(async () => {
    await app.close();
  });
});
