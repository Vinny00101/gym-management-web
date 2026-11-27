import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { Role, UserStatus } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../infra/database/prisma.service.js';
import type { AuthenticatedUser } from '../../shared/identity/auth.types.js';
import type { ListCheckInsQueryDto } from './dto/list-check-ins-query.dto.js';

const SAO_PAULO_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function getSaoPauloLocalDate(instant: Date): Date {
  const parts = SAO_PAULO_DATE_FORMATTER.formatToParts(instant);
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const day = Number(parts.find((part) => part.type === 'day')?.value);

  return new Date(Date.UTC(year, month - 1, day));
}

@Injectable()
export class CheckInsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: AuthenticatedUser, query: ListCheckInsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    if (
      query.memberId !== undefined &&
      (!Number.isInteger(query.memberId) || query.memberId <= 0)
    ) {
      throw new BadRequestException('memberId deve ser um inteiro positivo.');
    }

    if (query.from && query.to && query.from > query.to) {
      throw new BadRequestException('from deve ser anterior ou igual a to.');
    }

    if (user.role === Role.member) {
      if (query.memberId !== undefined && query.memberId !== user.id) {
        throw new ForbiddenException(
          'Você não pode consultar o histórico de outro membro.',
        );
      }
    } else if (user.role === Role.trainer) {
      if (query.memberId !== undefined) {
        const member = await this.prisma.user.findFirst({
          where: { id: query.memberId, role: Role.member },
          select: { id: true, instructorId: true },
        });

        if (!member) {
          throw new NotFoundException('Membro não encontrado.');
        }

        if (member.instructorId !== user.id) {
          throw new ForbiddenException(
            'Você não pode consultar o histórico deste membro.',
          );
        }
      }
    } else if (user.role !== Role.admin) {
      throw new ForbiddenException('Acesso negado.');
    }

    const localDate = this.getLocalDateRange(query);
    const where: Prisma.CheckInWhereInput = {
      ...(user.role === Role.member ? { memberId: user.id } : {}),
      ...(user.role === Role.trainer
        ? { member: { instructorId: user.id } }
        : {}),
      ...(query.memberId !== undefined ? { memberId: query.memberId } : {}),
      ...(localDate ? { localDate } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.checkIn.findMany({
        where,
        orderBy: { checkedInAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          memberId: true,
          checkedInAt: true,
          localDate: true,
        },
      }),
      this.prisma.checkIn.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async checkIn(user: AuthenticatedUser, requestedMemberId?: number) {
    const bodyMemberId = requestedMemberId ?? undefined;
    let memberId: number;

    if (user.role === Role.member) {
      if (bodyMemberId !== undefined && bodyMemberId !== user.id) {
        throw new ForbiddenException(
          'Você não pode registrar check-in para outro membro.',
        );
      }
      memberId = user.id;
    } else if (user.role === Role.admin) {
      if (bodyMemberId === undefined) {
        throw new BadRequestException(
          'memberId é obrigatório para administradores.',
        );
      }
      memberId = bodyMemberId;
    } else {
      throw new ForbiddenException('Acesso negado.');
    }

    if (!Number.isInteger(memberId) || memberId <= 0) {
      throw new BadRequestException('memberId deve ser um inteiro positivo.');
    }

    const member = await this.prisma.user.findFirst({
      where: { id: memberId, role: Role.member },
      select: { id: true, status: true },
    });

    if (!member) {
      throw new NotFoundException('Membro não encontrado.');
    }

    if (member.status !== UserStatus.active) {
      throw new UnprocessableEntityException(
        'Apenas membros ativos podem fazer check-in.',
      );
    }

    const checkedInAt = new Date();
    return this.prisma.checkIn.create({
      data: {
        memberId: member.id,
        checkedInAt,
        localDate: getSaoPauloLocalDate(checkedInAt),
      },
      select: {
        id: true,
        memberId: true,
        checkedInAt: true,
        localDate: true,
      },
    });
  }

  private getLocalDateRange(
    query: ListCheckInsQueryDto,
  ): Prisma.DateTimeFilter<'CheckIn'> | undefined {
    if (query.from === undefined && query.to === undefined) {
      const today = getSaoPauloLocalDate(new Date());
      const from = new Date(today);
      from.setUTCDate(from.getUTCDate() - 29);
      return { gte: from, lte: today };
    }

    return {
      ...(query.from !== undefined
        ? { gte: new Date(`${query.from}T00:00:00.000Z`) }
        : {}),
      ...(query.to !== undefined
        ? { lte: new Date(`${query.to}T00:00:00.000Z`) }
        : {}),
    };
  }
}
