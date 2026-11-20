import {
  UnauthorizedException,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../../auth.types.js';

/** Obtém o usuário autenticado (ou uma de suas propriedades) no controller. */
export const CurrentUser = createParamDecorator(
  <K extends keyof AuthenticatedUser>(
    property: K | undefined,
    context: ExecutionContext,
  ): AuthenticatedUser | AuthenticatedUser[K] => {
    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    return property ? user[property] : user;
  },
);
