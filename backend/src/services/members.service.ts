import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth.types.js';
import type { AssignTrainerDto } from '../common/dto/assign-trainer.dto.js';
import { Role } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

export type MemberProfile = {
  id: number;
  name: string;
  email: string;
  role: Role;
  status: string;
  instructor: { id: number; name: string; email: string } | null;
};

@Injectable()
export class MembersService {
  constructor(private readonly prisma: PrismaService) {}

  async assignTrainer(memberId: number, body: AssignTrainerDto) {
    const member = await this.prisma.user.findFirst({
      where: { id: memberId, role: Role.member },
      select: { id: true },
    });
    if (!member) {
      throw new NotFoundException('Member not found');
    }

    const trainer = await this.prisma.user.findFirst({
      where: { id: body.trainerId, role: Role.trainer },
      select: { id: true },
    });
    if (!trainer) {
      throw new UnprocessableEntityException(
        'Trainer id must refer to a trainer',
      );
    }

    return this.prisma.user.update({
      where: { id: memberId },
      data: { instructorId: trainer.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        instructor: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  async getProfile(currentUser: AuthenticatedUser): Promise<MemberProfile> {
    const member = await this.prisma.user.findFirst({
      where: { id: currentUser.id, role: Role.member },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        instructor: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    return member;
  }
}
