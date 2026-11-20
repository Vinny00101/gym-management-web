import {
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Role, UserStatus } from '../../generated/prisma/enums.js';
import type { AuthenticatedRequest } from '../auth.types.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

describe('JwtAuthGuard', () => {
  const request = {
    headers: { authorization: 'Bearer valid-token' },
    method: 'GET',
    originalUrl: '/me',
    ip: '192.0.2.10',
    socket: { remoteAddress: '192.0.2.10' },
  } as unknown as AuthenticatedRequest;

  const reflector = { getAllAndOverride: vi.fn() };
  const jwt = { verifyAsync: vi.fn() };
  const prisma = { user: { findUnique: vi.fn() } };
  const events = { tokenRefused: vi.fn() };

  const guard = new JwtAuthGuard(
    reflector as never,
    jwt as never,
    prisma as never,
    events as never,
  );

  const context = {
    getHandler: () => 'handler',
    getClass: () => 'controller',
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  beforeEach(() => {
    vi.clearAllMocks();
    request.headers.authorization = 'Bearer valid-token';
    delete request.user;
    reflector.getAllAndOverride.mockReturnValue(false);
    jwt.verifyAsync.mockResolvedValue({ sub: 7, role: Role.member });
    prisma.user.findUnique.mockResolvedValue({
      id: 7,
      role: Role.member,
      status: UserStatus.active,
    });
  });

  it('aceita token válido e anexa o usuário com id e papel do banco', async () => {
    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(jwt.verifyAsync).toHaveBeenCalledWith('valid-token', {
      algorithms: ['HS256'],
    });
    expect(request.user).toEqual({ id: 7, role: Role.member });
  });

  it('libera rotas @Public() sem token', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    delete request.headers.authorization;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(jwt.verifyAsync).not.toHaveBeenCalled();
  });

  it('exige token em rota sem @Public()', async () => {
    delete request.headers.authorization;

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(events.tokenRefused).toHaveBeenCalledWith(
      request,
      'missing_token',
    );
  });

  it('rejeita token inválido ou expirado', async () => {
    jwt.verifyAsync.mockRejectedValue(new Error('jwt expired'));

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(events.tokenRefused).toHaveBeenCalledWith(
      request,
      'invalid_token',
    );
  });

  it('rejeita payload sem id ou com papel desconhecido', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: 'not-a-number', role: 'root' });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(events.tokenRefused).toHaveBeenCalledWith(
      request,
      'invalid_payload',
    );
  });

  it('rejeita usuário suspenso ou inativo mesmo com token válido', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 7,
      role: Role.member,
      status: UserStatus.suspended,
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(events.tokenRefused).toHaveBeenCalledWith(
      request,
      'inactive_user',
    );
  });
});
