import { ForbiddenException } from '@nestjs/common';
import { Role } from '../generated/prisma/enums.js';
import { OwnershipService } from './ownership.service.js';

describe('OwnershipService', () => {
  const service = new OwnershipService();

  it('permite que o admin acesse qualquer membro', () => {
    expect(() =>
      service.assertCanAccessMember(
        { id: 1, role: Role.admin },
        { id: 99, instructorId: 42 },
      ),
    ).not.toThrow();
  });

  it('permite que o membro acesse apenas os próprios dados', () => {
    expect(() =>
      service.assertCanAccessMember(
        { id: 7, role: Role.member },
        { id: 7, instructorId: 3 },
      ),
    ).not.toThrow();

    expect(() =>
      service.assertCanAccessMember(
        { id: 7, role: Role.member },
        { id: 8, instructorId: 3 },
      ),
    ).toThrow(ForbiddenException);
  });

  it('permite que o instrutor acesse apenas os membros a ele associados', () => {
    expect(() =>
      service.assertCanAccessMember(
        { id: 3, role: Role.trainer },
        { id: 15, instructorId: 3 },
      ),
    ).not.toThrow();

    expect(() =>
      service.assertCanAccessMember(
        { id: 3, role: Role.trainer },
        { id: 16, instructorId: 4 },
      ),
    ).toThrow(ForbiddenException);

    expect(() =>
      service.assertCanAccessMember(
        { id: 3, role: Role.trainer },
        { id: 16, instructorId: null },
      ),
    ).toThrow(ForbiddenException);
  });
});
