import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { Logger } from 'nestjs-pino';
import { getRequestId } from '../middleware/request-id.middleware.js';

export type SecurityEventName =
  | 'auth.login_succeeded'
  | 'auth.login_failed'
  | 'auth.access_denied'
  | 'auth.token_refused';

export interface SecurityEvent {
  event: SecurityEventName;
  requestId: string;
  ip?: string;
  email?: string;
  route?: string;
  reason?: string;
}

/**
 * Eventos de segurança (RNF10): sempre correlacionados ao request id e ao IP.
 * A senha nunca entra neste registro.
 */
@Injectable()
export class SecurityEventService {
  constructor(private readonly logger: Logger) {}

  record(event: SecurityEvent): void {
    this.logger.warn(event, 'security');
  }

  loginSucceeded(request: Request, userId: number): void {
    this.fromRequest(request, {
      event: 'auth.login_succeeded',
      reason: `user:${userId}`,
    });
  }

  loginFailed(request: Request, email: string): void {
    this.fromRequest(request, { event: 'auth.login_failed', email });
  }

  accessDenied(request: Request, reason: string): void {
    this.fromRequest(request, { event: 'auth.access_denied', reason });
  }

  tokenRefused(request: Request, reason: string): void {
    this.fromRequest(request, { event: 'auth.token_refused', reason });
  }

  private fromRequest(
    request: Request,
    data: Omit<SecurityEvent, 'requestId' | 'ip' | 'route'> &
      Partial<Pick<SecurityEvent, 'ip' | 'route'>>,
  ): void {
    this.record({
      requestId: getRequestId(request),
      ip: request.ip ?? request.socket?.remoteAddress ?? 'unknown',
      route: `${request.method} ${request.originalUrl ?? request.url}`,
      ...data,
    });
  }
}
