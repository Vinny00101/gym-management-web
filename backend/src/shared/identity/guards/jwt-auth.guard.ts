import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { PrismaService } from '../../../infra/database/prisma.service.js';
import { SecurityEventService } from '../../security/security-event.service.js';
import type {
  AccessTokenPayload,
  AuthenticatedRequest,
} from '../auth.types.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { Role, UserStatus } from '../../../generated/prisma/enums.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly securityEvents: SecurityEventService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(request);

    if (!token) {
      this.deny(request, 'missing_token');
      throw new UnauthorizedException('Authentication required');
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        algorithms: ['HS256'],
      });
    } catch {
      this.deny(request, 'invalid_token');
      throw new UnauthorizedException('Authentication required');
    }

    if (
      typeof payload.sub !== 'number' ||
      !Object.values(Role).includes(payload.role)
    ) {
      this.deny(request, 'invalid_payload');
      throw new UnauthorizedException('Authentication required');
    }

    // O papel e a situação vêm do banco: uma promoção, rebaixamento ou
    // suspensão passa a valer no próximo request, sem depender do token antigo.
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, status: true },
    });

    if (!user || user.status !== UserStatus.active) {
      this.deny(request, 'inactive_user');
      throw new UnauthorizedException('Authentication required');
    }

    request.user = { id: user.id, role: user.role };
    return true;
  }

  private extractToken(request: Request): string | null {
    const authorization = request.headers.authorization;
    const [scheme, token] = authorization?.split(' ') ?? [];
    return scheme?.toLowerCase() === 'bearer' && token ? token : null;
  }

  private deny(request: AuthenticatedRequest, reason: string): void {
    this.securityEvents.tokenRefused(request, reason);
  }
}
