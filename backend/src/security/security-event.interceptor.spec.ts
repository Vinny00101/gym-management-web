import { CallHandler, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { Logger } from 'nestjs-pino';
import { firstValueFrom, of, throwError } from 'rxjs';
import { SecurityEventInterceptor } from './security-event.interceptor.js';
import { SecurityEventService } from './security-event.service.js';

describe('SecurityEventInterceptor', () => {
  const warn = vi.fn();
  const events = new SecurityEventService({ warn } as unknown as Logger);
  const interceptor = new SecurityEventInterceptor(events);

  const request = {
    method: 'PATCH',
    originalUrl: '/members/123',
    ip: '192.0.2.10',
    socket: { remoteAddress: '192.0.2.10' },
    headers: { 'x-request-id': 'request-123' },
    user: { id: 7, role: 'member' },
  } as unknown as Request;

  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  beforeEach(() => warn.mockClear());

  it('registra um 403 lançado por um service', async () => {
    const error = new ForbiddenException('Insufficient permissions');
    const handler: CallHandler = { handle: () => throwError(() => error) };

    await expect(firstValueFrom(interceptor.intercept(context, handler))).rejects.toBe(error);

    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'auth.access_denied',
        reason: 'status:403',
        ip: '192.0.2.10',
        requestId: 'request-123',
        route: 'PATCH /members/123',
      }),
      'security',
    );
  });

  it('registra um 401 lançado por um service', async () => {
    const error = new UnauthorizedException('Authentication required');
    const handler: CallHandler = { handle: () => throwError(() => error) };

    await expect(firstValueFrom(interceptor.intercept(context, handler))).rejects.toBe(error);

    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'auth.access_denied', reason: 'status:401' }),
      'security',
    );
  });

  it('não registra outros erros', async () => {
    const error = new Error('boom');
    const handler: CallHandler = { handle: () => throwError(() => error) };

    await expect(firstValueFrom(interceptor.intercept(context, handler))).rejects.toBe(error);

    expect(warn).not.toHaveBeenCalled();
  });

  it('não altera respostas com sucesso', async () => {
    const handler: CallHandler = { handle: () => of({ ok: true }) };

    await expect(firstValueFrom(interceptor.intercept(context, handler))).resolves.toEqual({
      ok: true,
    });
    expect(warn).not.toHaveBeenCalled();
  });
});
