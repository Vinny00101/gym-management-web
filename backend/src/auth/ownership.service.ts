import { ForbiddenException, Injectable } from '@nestjs/common';
import { Role } from '../generated/prisma/enums.js';
import type { AuthenticatedUser } from './auth.types.js';

export interface OwnershipTarget {
  id: number;
  instructorId?: number | null;
}

/**
 * Padrão único de checagem de posse (RNF07/RD11).
 * Chame sempre no service, antes de qualquer leitura ou escrita do recurso.
 */
@Injectable()
export class OwnershipService {
  assertCanAccessMember(
    currentUser: AuthenticatedUser,
    target: OwnershipTarget,
  ): void {
    if (currentUser.role === Role.admin) {
      return;
    }

    const isOwnMember =
      currentUser.role === Role.member && target.id === currentUser.id;
    const isAssignedMember =
      currentUser.role === Role.trainer &&
      target.instructorId === currentUser.id;

    if (isOwnMember || isAssignedMember) {
      return;
    }

    throw new ForbiddenException('You do not have access to this resource');
  }
}
