import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Role } from '../../generated/prisma/enums.js';
import type { PrismaService } from '../../infra/database/prisma.service.js';
import { ListCheckInsQueryDto } from './dto/list-check-ins-query.dto.js';
import { CheckInsService } from './check-ins.service.js';

describe('CheckInsService history', () => {
  const items = [
    {
      id: 1,
      memberId: 7,
      checkedInAt: new Date('2026-11-25T12:00:00.000Z'),
      localDate: new Date('2026-11-25T00:00:00.000Z'),
    },
  ];
  const prisma = {
    user: { findFirst: vi.fn() },
    checkIn: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  const service = new CheckInsService(prisma as unknown as PrismaService);

  const makeQuery = (
    overrides: Partial<ListCheckInsQueryDto> = {},
  ): ListCheckInsQueryDto => ({
    page: 1,
    pageSize: 20,
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-26T02:30:00.000Z'));
    prisma.user.findFirst.mockResolvedValue({ id: 10, instructorId: 2 });
    prisma.checkIn.findMany.mockResolvedValue(items);
    prisma.checkIn.count.mockResolvedValue(25);
    prisma.$transaction.mockImplementation(
      async (queries: Promise<unknown>[]) => Promise.all(queries),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('filters admin history by member and local-date range and paginates results', async () => {
    const result = await service.findAll(
      { id: 1, role: Role.admin },
      makeQuery({
        memberId: 7,
        from: '2026-11-20',
        to: '2026-11-22',
        page: 2,
        pageSize: 10,
      }),
    );

    const where = {
      memberId: 7,
      localDate: {
        gte: new Date('2026-11-20T00:00:00.000Z'),
        lte: new Date('2026-11-22T00:00:00.000Z'),
      },
    };
    expect(prisma.checkIn.findMany).toHaveBeenCalledWith({
      where,
      orderBy: { checkedInAt: 'desc' },
      skip: 10,
      take: 10,
      select: {
        id: true,
        memberId: true,
        checkedInAt: true,
        localDate: true,
      },
    });
    expect(prisma.checkIn.count).toHaveBeenCalledWith({ where });
    expect(result).toEqual({ items, total: 25, page: 2, pageSize: 10 });
  });

  it('scopes trainer history in Prisma and verifies an explicitly requested member', async () => {
    await service.findAll({ id: 2, role: Role.trainer }, makeQuery());

    expect(prisma.checkIn.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          member: { instructorId: 2 },
          localDate: {
            gte: new Date('2026-10-27T00:00:00.000Z'),
            lte: new Date('2026-11-25T00:00:00.000Z'),
          },
        },
      }),
    );

    await service.findAll(
      { id: 2, role: Role.trainer },
      makeQuery({ memberId: 10 }),
    );
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { id: 10, role: Role.member },
      select: { id: true, instructorId: true },
    });
  });

  it('fixes member scope to the authenticated user and denies another member id', async () => {
    await service.findAll(
      { id: 7, role: Role.member },
      makeQuery({ memberId: 7 }),
    );
    expect(prisma.checkIn.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          memberId: 7,
          localDate: expect.any(Object),
        },
      }),
    );

    await expect(
      service.findAll(
        { id: 7, role: Role.member },
        makeQuery({ memberId: 10 }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('denies trainers who request a member assigned to another trainer', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 10, instructorId: 8 });

    await expect(
      service.findAll(
        { id: 2, role: Role.trainer },
        makeQuery({ memberId: 10 }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.checkIn.findMany).not.toHaveBeenCalled();
  });

  it('uses the last 30 local calendar days by default', async () => {
    await service.findAll({ id: 1, role: Role.admin }, makeQuery());

    expect(prisma.checkIn.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          localDate: {
            gte: new Date('2026-10-27T00:00:00.000Z'),
            lte: new Date('2026-11-25T00:00:00.000Z'),
          },
        },
      }),
    );
  });

  it('rejects reversed date ranges before querying Prisma', async () => {
    await expect(
      service.findAll(
        { id: 1, role: Role.admin },
        makeQuery({ from: '2026-11-27', to: '2026-11-26' }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.checkIn.findMany).not.toHaveBeenCalled();
    expect(prisma.checkIn.count).not.toHaveBeenCalled();
  });
});
