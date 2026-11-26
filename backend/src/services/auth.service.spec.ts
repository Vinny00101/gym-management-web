import { UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Role, UserStatus } from '../generated/prisma/enums.js';
import type { PrismaService } from '../infra/database/prisma.service.js';
import type { SecurityEventService } from '../shared/security/security-event.service.js';
import { AuthService } from './auth.service.js';
import type { PasswordService } from './password.service.js';
import type { RefreshTokenService } from './refresh-token.service.js';
import type { JwtService } from '@nestjs/jwt';

describe('AuthService', () => {
  const activeUser = {
    id: 7,
    name: 'Ana',
    email: 'ana@example.com',
    passwordHash: '$argon2id$hash',
    role: Role.member,
    status: UserStatus.active,
  };

  const prisma = {
    user: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
  };
  const jwt = { signAsync: vi.fn() };
  const passwords = { verify: vi.fn() };
  const refresh = { issue: vi.fn(), rotate: vi.fn(), revoke: vi.fn() };
  const events = {
    loginFailed: vi.fn(),
    loginSucceeded: vi.fn(),
    tokenRefused: vi.fn(),
    accessDenied: vi.fn(),
    record: vi.fn(),
  };

  const service = new AuthService(
    prisma as unknown as PrismaService,
    jwt as unknown as JwtService,
    passwords as unknown as PasswordService,
    refresh as unknown as RefreshTokenService,
    events as unknown as SecurityEventService,
  );

  const request = {
    method: 'POST',
    originalUrl: '/auth/login',
    ip: '192.0.2.10',
    socket: { remoteAddress: '192.0.2.10' },
    headers: {},
  } as unknown as Request;
  const response = {
    cookie: vi.fn(),
    clearCookie: vi.fn(),
  } as unknown as Response;

  beforeEach(() => {
    vi.clearAllMocks();
    jwt.signAsync.mockResolvedValue('signed.jwt.token');
    passwords.verify.mockResolvedValue(true);
    prisma.user.findUnique.mockResolvedValue(activeUser);
    prisma.user.findUniqueOrThrow.mockResolvedValue(activeUser);
    refresh.issue.mockResolvedValue('opaque-refresh-token');
    refresh.rotate.mockResolvedValue(activeUser.id);
  });

  it('retorna access token de 15 minutos e guarda só o refresh token opaco', async () => {
    const result = await service.login(
      '  ANA@EXAMPLE.COM  ',
      'Senha@123',
      request,
      response,
    );

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'ana@example.com' },
    });
    expect(passwords.verify).toHaveBeenCalledWith(
      'Senha@123',
      activeUser.passwordHash,
    );
    expect(jwt.signAsync).toHaveBeenCalledWith({
      sub: activeUser.id,
      role: Role.member,
    });
    expect(refresh.issue).toHaveBeenCalledWith(activeUser.id, response);
    expect(result).toEqual({
      accessToken: 'signed.jwt.token',
      tokenType: 'Bearer',
      expiresIn: 900,
      user: { id: 7, name: 'Ana', role: Role.member },
    });
    expect(JSON.stringify(result)).not.toContain('passwordHash');
    expect(events.loginFailed).not.toHaveBeenCalled();
  });

  it('usa a mesma mensagem para e-mail inexistente e senha errada', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    passwords.verify.mockResolvedValue(false);

    await expect(
      service.login('nobody@example.com', 'Senha@123', request, response),
    ).rejects.toThrow(
      new UnauthorizedException('E-mail ou senha inválidos'),
    );
    expect(events.loginFailed).toHaveBeenCalledWith(
      request,
      'nobody@example.com',
    );

    vi.clearAllMocks();
    jwt.signAsync.mockResolvedValue('signed.jwt.token');
    passwords.verify.mockResolvedValue(false);

    await expect(
      service.login('ana@example.com', 'senha-errada', request, response),
    ).rejects.toThrow('E-mail ou senha inválidos');
    expect(events.loginFailed).toHaveBeenCalledWith(request, 'ana@example.com');
    expect(jwt.signAsync).not.toHaveBeenCalled();
    expect(refresh.issue).not.toHaveBeenCalled();
  });

  it.each([UserStatus.inactive, UserStatus.suspended])(
    'nega login para membro %s',
    async (status) => {
      prisma.user.findUnique.mockResolvedValue({ ...activeUser, status });

      await expect(
        service.login('ana@example.com', 'Senha@123', request, response),
      ).rejects.toThrow('E-mail ou senha inválidos');
      expect(events.loginFailed).toHaveBeenCalledWith(
        request,
        'ana@example.com',
      );
      expect(refresh.issue).not.toHaveBeenCalled();
    },
  );

  it('emite novo access token ao rotacionar o refresh token', async () => {
    const result = await service.refresh('old-refresh-token', response);

    expect(refresh.rotate).toHaveBeenCalledWith('old-refresh-token', response);
    expect(jwt.signAsync).toHaveBeenCalledWith({
      sub: activeUser.id,
      role: Role.member,
    });
    expect(result.accessToken).toBe('signed.jwt.token');
    expect(JSON.stringify(result)).not.toContain('passwordHash');
  });

  it('revoga o refresh token no logout', async () => {
    await expect(
      service.logout('current-refresh-token', response),
    ).resolves.toBeUndefined();

    expect(refresh.revoke).toHaveBeenCalledWith(
      'current-refresh-token',
      response,
    );
  });
});
