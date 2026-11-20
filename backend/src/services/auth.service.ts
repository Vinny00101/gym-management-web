import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import { Role, UserStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SecurityEventService } from '../security/security-event.service.js';
import type { LoginResult } from '../auth.types.js';
import { DUMMY_PASSWORD_HASH } from './password.crypto.js';
import { PasswordService } from './password.service.js';
import { RefreshTokenService } from './refresh-token.service.js';

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly passwordService: PasswordService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly securityEvents: SecurityEventService,
  ) {}

  async login(
    email: string,
    password: string,
    request: Request,
    response: Response,
  ): Promise<LoginResult> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // Mesmo custo de hash quer o e-mail exista, quer não exista.
    const passwordMatches = await this.passwordService.verify(
      password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );

    if (!user || !passwordMatches || user.status !== UserStatus.active) {
      this.securityEvents.loginFailed(request, normalizedEmail);
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    await this.refreshTokens.issue(user.id, response);
    this.securityEvents.loginSucceeded(request, user.id);
    return this.buildLoginResult(user.id, user.name, user.role);
  }

  async refresh(
    rawToken: string | undefined,
    response: Response,
  ): Promise<LoginResult> {
    const userId = await this.refreshTokens.rotate(rawToken, response);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, name: true, role: true, status: true },
    });

    if (user.status !== UserStatus.active) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    return this.buildLoginResult(user.id, user.name, user.role);
  }

  async logout(
    rawToken: string | undefined,
    response: Response,
  ): Promise<void> {
    await this.refreshTokens.revoke(rawToken, response);
  }

  private async buildLoginResult(
    id: number,
    name: string,
    role: Role,
  ): Promise<LoginResult> {
    const accessToken = await this.jwtService.signAsync({ sub: id, role });
    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      user: { id, name, role },
    };
  }
}
