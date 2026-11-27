import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Role, UserStatus } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../infra/database/prisma.service.js';
import type { AuthenticatedUser } from '../../shared/identity/auth.types.js';

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
}
