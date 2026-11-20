import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { UserStatus } from '../generated/prisma/enums.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import {
  parseDurationToMs,
  REFRESH_COOKIE_NAME,
  RefreshTokenService,
} from './refresh-token.service.js';

describe('parseDurationToMs', () => {
  it('converte durações', () => {
    expect(parseDurationToMs('15m')).toBe(900_000);
    expect(parseDurationToMs('7d')).toBe(604_800_000);
    expect(parseDurationToMs('30s')).toBe(30_000);
  });

  it('rejeita formato inválido', () => {
    expect(() => parseDurationToMs('tomorrow')).toThrow('Invalid duration');
  });
});

describe('RefreshTokenService', () => {
  const cookie = vi.fn();
  const clearCookie = vi.fn();
  const response = { cookie, clearCookie } as unknown as Response;

  const tx = {
    refreshToken: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
  };
  const prisma = {
    refreshToken: {
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  };
  const config = {
    getOrThrow: vi.fn().mockReturnValue('7d'),
    get: vi.fn().mockReturnValue('test'),
  };

  const service = new RefreshTokenService(
    prisma as unknown as PrismaService,
    config as unknown as ConfigService,
  );

  const future = new Date(Date.now() + 60_000);
  const past = new Date(Date.now() - 60_000);
  const storedHash = 'a'.repeat(64);

  const record = (overrides: Record<string, unknown> = {}) => ({
    id: 1,
    tokenHash: storedHash,
    userId: 7,
    expiresAt: future,
    revokedAt: null,
    user: { status: UserStatus.active },
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    config.getOrThrow.mockReturnValue('7d');
    config.get.mockReturnValue('test');
    tx.refreshToken.findUnique.mockResolvedValue(record());
    tx.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    tx.refreshToken.create.mockResolvedValue({ id: 2 });
    prisma.refreshToken.create.mockResolvedValue({ id: 1 });
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
  });

  it('guarda apenas o hash SHA-256 e envia o cookie httpOnly SameSite=Strict', async () => {
    const token = await service.issue(7, response);
    const data = prisma.refreshToken.create.mock.calls[0][0].data;

    expect(data.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(data.tokenHash).not.toBe(token);
    expect(data.userId).toBe(7);
    expect(data.expiresAt.getTime() - Date.now()).toBeGreaterThan(600_000);
    expect(cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      token,
      expect.objectContaining({
        httpOnly: true,
        secure: false,
        sameSite: 'strict',
        path: '/auth',
        maxAge: 604_800_000,
      }),
    );
  });

  it('usa Secure em produção', async () => {
    config.get.mockReturnValue('production');
    const productionService = new RefreshTokenService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
    );

    await productionService.issue(7, response);

    expect(cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      expect.any(String),
      expect.objectContaining({ secure: true }),
    );
  });

  it('rotaciona o token em transação e troca o cookie', async () => {
    await expect(service.rotate('old-token', response)).resolves.toBe(7);

    expect(tx.refreshToken.findUnique).toHaveBeenCalled();
    expect(tx.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { revokedAt: expect.any(Date) } }),
    );
    expect(tx.refreshToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 7,
          tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      }),
    );
    expect(cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      expect.any(String),
      expect.any(Object),
    );
  });

  it.each([
    ['desconhecido', null],
    ['revogado', record({ revokedAt: new Date() })],
    ['expirado', record({ expiresAt: past })],
    [
      'de usuário inativo',
      record({ user: { status: UserStatus.suspended } }),
    ],
  ])('rejeita token %s', async (_label, found) => {
    tx.refreshToken.findUnique.mockResolvedValue(found);

    await expect(service.rotate('bad-token', response)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(tx.refreshToken.create).not.toHaveBeenCalled();
  });

  it('rejeita ausência de cookie', async () => {
    await expect(service.rotate(undefined, response)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('revoga o token e limpa o cookie no logout', async () => {
    await expect(service.revoke('current-token', response)).resolves.toBeUndefined();

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
          revokedAt: null,
        }),
        data: { revokedAt: expect.any(Date) },
      }),
    );
    expect(clearCookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'strict',
        path: '/auth',
      }),
    );
    expect(clearCookie.mock.calls[0][1]).not.toHaveProperty('maxAge');
  });
});
