import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Role } from '../../generated/prisma/enums.js';
import type { AuthenticatedRequest } from '../../auth.types.js';
import { RolesGuard } from './roles.guard.js';

describe('RolesGuard', () => {
  const request = {
    method: 'GET',
    originalUrl: '/admin',
    ip: '192.0.2.10',
    socket: { remoteAddress: '192.0.2.10' },
    headers: {},
  } as unknown as AuthenticatedRequest;

  const reflector = { getAllAndOverride: vi.fn() };
  const events = { accessDenied: vi.fn() };
  const guard = new RolesGuard(reflector as never, events as never);

  const context = {
    getHandler: () => 'handler',
    getClass: () => 'controller',
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  beforeEach(() => {
    vi.clearAllMocks();
    delete request.user;
    reflector.getAllAndOverride.mockImplementation((key: string) =>
      key === 'isPublic' ? false : [Role.admin],
    );
  });

  it('permite o papel declarado em @Roles()', () => {
    request.user = { id: 1, role: Role.admin };

    expect(guard.canActivate(context)).toBe(true);
    expect(events.accessDenied).not.toHaveBeenCalled();
  });

  it('bloqueia outros papéis com 403 e registra o evento', () => {
    request.user = { id: 2, role: Role.member };

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(events.accessDenied).toHaveBeenCalledWith(request, 'role:member');
  });

  it('libera rotas @Public()', () => {
    reflector.getAllAndOverride.mockImplementation((key: string) =>
      key === 'isPublic' ? true : [Role.admin],
    );

    expect(guard.canActivate(context)).toBe(true);
  });

  it('não exige papéis quando @Roles() não foi usado', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('exige usuário autenticado quando @Roles() foi usado', () => {
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    expect(events.accessDenied).toHaveBeenCalledWith(
      request,
      'missing_user',
    );
  });
});
