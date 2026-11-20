import type { Request } from 'express';
import type { Role } from './generated/prisma/enums.js';

/** Dados do usuário disponíveis para guards, decorators e services. */
export interface AuthenticatedUser {
  id: number;
  role: Role;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

/** Payload do access token: só identidade e papel, sem dados sensíveis. */
export interface AccessTokenPayload {
  sub: number;
  role: Role;
  iat?: number;
  exp?: number;
}

export interface LoginResult {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: {
    id: number;
    name: string;
    role: Role;
  };
}
