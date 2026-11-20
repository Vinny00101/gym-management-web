import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import type { Response } from 'express';
import { UserStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

export const REFRESH_COOKIE_NAME = 'refresh_token';
const REFRESH_COOKIE_PATH = '/auth';

const DURATION_UNITS = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
} as const;

export function parseDurationToMs(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration);
  if (!match) {
    throw new Error(`Invalid duration: ${duration}`);
  }
  const amount = Number(match[1]);
  const unit = match[2] as keyof typeof DURATION_UNITS;
  return amount * DURATION_UNITS[unit];
}

@Injectable()
export class RefreshTokenService {
  private readonly ttlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.ttlMs = parseDurationToMs(
      config.getOrThrow<string>('REFRESH_TOKEN_EXPIRES_IN'),
    );
  }

  /** Gera um token opaco, guarda só o hash SHA-256 e escreve o cookie. */
  async issue(userId: number, response: Response): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await this.prisma.refreshToken.create({
      data: {
        tokenHash: this.hash(token),
        userId,
        expiresAt: new Date(Date.now() + this.ttlMs),
      },
    });
    this.setCookie(response, token);
    return token;
  }

  /** Roda a rotação em transação: o token antigo deixa de valer no mesmo ato. */
  async rotate(
    rawToken: string | undefined,
    response: Response,
  ): Promise<number> {
    if (!rawToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const record = await tx.refreshToken.findUnique({
        where: { tokenHash: this.hash(rawToken) },
        include: { user: { select: { status: true } } },
      });

      if (
        !record ||
        record.revokedAt !== null ||
        record.expiresAt <= now ||
        record.user.status !== UserStatus.active
      ) {
        return null;
      }

      const revoked = await tx.refreshToken.updateMany({
        where: { id: record.id, revokedAt: null },
        data: { revokedAt: now },
      });
      if (revoked.count !== 1) {
        return null;
      }

      const nextToken = randomBytes(32).toString('base64url');
      await tx.refreshToken.create({
        data: {
          tokenHash: this.hash(nextToken),
          userId: record.userId,
          expiresAt: new Date(Date.now() + this.ttlMs),
        },
      });
      return { userId: record.userId, nextToken };
    });

    if (!result) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    this.setCookie(response, result.nextToken);
    return result.userId;
  }

  /** Revoga o token atual e remove o cookie do navegador. */
  async revoke(rawToken: string | undefined, response: Response): Promise<void> {
    if (rawToken) {
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash: this.hash(rawToken), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    response.clearCookie(REFRESH_COOKIE_NAME, this.cookieOptions(false));
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private cookieOptions(withMaxAge = true): Record<string, unknown> {
    return {
      httpOnly: true,
      secure: this.config.get<string>('NODE_ENV') === 'production',
      sameSite: 'strict',
      path: REFRESH_COOKIE_PATH,
      ...(withMaxAge ? { maxAge: this.ttlMs } : {}),
    };
  }

  private setCookie(response: Response, token: string): void {
    response.cookie(REFRESH_COOKIE_NAME, token, this.cookieOptions());
  }
}
