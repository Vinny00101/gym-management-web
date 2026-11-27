import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Role, UserStatus } from '../../generated/prisma/enums.js';
import type { PrismaService } from '../../infra/database/prisma.service.js';
import { CheckInsService, getSaoPauloLocalDate } from './check-ins.service.js';

describe('CheckInsService', () => {
  const memberUser = { id: 7, status: UserStatus.active };
  const prisma = {
    user: { findFirst: vi.fn() },
    checkIn: { create: vi.fn() },
  };
  const service = new CheckInsService(prisma as unknown as PrismaService);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-26T12:34:56.000Z'));
    prisma.user.findFirst.mockResolvedValue(memberUser);
    prisma.checkIn.create.mockImplementation(async ({ data }) => ({
      id: 1,
      ...data,
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('registra check-in do membro autenticado com data local e resposta explícita', async () => {
    const result = await service.checkIn({ id: 7, role: Role.member });

    expect(result).toEqual({
      id: 1,
      memberId: 7,
      checkedInAt: new Date('2026-11-26T12:34:56.000Z'),
      localDate: new Date('2026-11-26T00:00:00.000Z'),
    });
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { id: 7, role: Role.member },
      select: { id: true, status: true },
    });
    expect(prisma.checkIn.create).toHaveBeenCalledOnce();
  });

  it('permite que um administrador registre check-in para um membro informado', async () => {
    await service.checkIn({ id: 1, role: Role.admin }, 7);

    expect(prisma.checkIn.create).toHaveBeenCalledOnce();
  });

  it('rejeita membro que tenta registrar check-in para outra pessoa', async () => {
    await expect(
      service.checkIn({ id: 7, role: Role.member }, 8),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.user.findFirst).not.toHaveBeenCalled();
    expect(prisma.checkIn.create).not.toHaveBeenCalled();
  });

  it('exige memberId para administradores e valida que seja positivo', async () => {
    await expect(
      service.checkIn({ id: 1, role: Role.admin }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.checkIn({ id: 1, role: Role.admin }, 0),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });

  it('retorna 404 para membro inexistente e 422 para membro inativo ou suspenso', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(
      service.checkIn({ id: 1, role: Role.admin }, 99),
    ).rejects.toBeInstanceOf(NotFoundException);

    for (const status of [UserStatus.inactive, UserStatus.suspended]) {
      prisma.user.findFirst.mockResolvedValue({ ...memberUser, status });
      await expect(
        service.checkIn({ id: 1, role: Role.admin }, 7),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    }

    expect(prisma.checkIn.create).not.toHaveBeenCalled();
  });

  it('deixa o banco arbitrar duplicidade sem consulta prévia', async () => {
    const duplicateError = new Error('unique constraint');
    prisma.checkIn.create.mockRejectedValue(duplicateError);

    await expect(service.checkIn({ id: 7, role: Role.member })).rejects.toBe(
      duplicateError,
    );

    expect(prisma.checkIn.create).toHaveBeenCalledOnce();
  });

  it('permite um check-in em cada dia local na virada da meia-noite de São Paulo', async () => {
    vi.setSystemTime(new Date('2026-11-26T02:30:00.000Z'));
    const previousDay = await service.checkIn({
      id: 7,
      role: Role.member,
    });

    vi.setSystemTime(new Date('2026-11-26T03:00:00.000Z'));
    const newDay = await service.checkIn({ id: 7, role: Role.member });

    expect(previousDay.localDate.toISOString()).toBe(
      '2026-11-25T00:00:00.000Z',
    );
    expect(newDay.localDate.toISOString()).toBe('2026-11-26T00:00:00.000Z');
    expect(prisma.checkIn.create).toHaveBeenCalledTimes(2);
  });

  it.each([
    [
      '02:30 UTC ainda é dia anterior em São Paulo',
      '2026-11-26T02:30:00.000Z',
      '2026-11-25T00:00:00.000Z',
    ],
    [
      '03:00 UTC inicia o novo dia em São Paulo',
      '2026-11-26T03:00:00.000Z',
      '2026-11-26T00:00:00.000Z',
    ],
  ])('%s', (_description, instant, expected) => {
    expect(getSaoPauloLocalDate(new Date(instant)).toISOString()).toBe(
      expected,
    );
  });
});
