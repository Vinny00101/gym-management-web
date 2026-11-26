import { Test } from '@nestjs/testing';
import type { Request } from 'express';
import { Logger } from 'nestjs-pino';
import { SecurityEventService } from './security-event.service.js';

describe('SecurityEventService', () => {
  const warn = vi.fn();
  const service = new SecurityEventService({ warn } as unknown as Logger);

  const request = {
    method: 'POST',
    originalUrl: '/auth/login',
    ip: '192.0.2.10',
    socket: { remoteAddress: '192.0.2.10' },
    headers: { 'x-request-id': 'request-123' },
  } as unknown as Request;

  beforeEach(() => {
    warn.mockClear();
  });

  it('registra falha de login com e-mail, IP e request id, sem a senha', () => {
    service.loginFailed(request, 'user@example.com');

    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'auth.login_failed',
        email: 'user@example.com',
        ip: '192.0.2.10',
        requestId: 'request-123',
        route: 'POST /auth/login',
      }),
      'security',
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain('password');
  });

  it('registra acesso negado com o motivo', () => {
    service.accessDenied(request, 'role:member');

    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'auth.access_denied',
        reason: 'role:member',
      }),
      'security',
    );
  });

  it('registra token recusado', () => {
    service.tokenRefused(request, 'missing_token');

    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'auth.token_refused',
        reason: 'missing_token',
      }),
      'security',
    );
  });

  it('pode ser resolvido pelo container com o logger do nestjs-pino', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SecurityEventService,
        { provide: Logger, useValue: { warn: vi.fn() } },
      ],
    }).compile();

    expect(moduleRef.get(SecurityEventService)).toBeInstanceOf(
      SecurityEventService,
    );
  });
});
