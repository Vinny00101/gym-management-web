import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { UpdateMemberDto } from '../common/dto/update-member.dto.js';
import type { UpdateMemberStatusDto } from '../common/dto/update-member-status.dto.js';
import { Role } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

export type MemberResponse = {
  id: number;
  name: string;
  email: string;
  role: Role;
  status: string;
};

@Injectable()
export class MembersService {
  constructor(private readonly prisma: PrismaService) {}

  async update(
    memberId: number,
    body: UpdateMemberDto,
  ): Promise<MemberResponse> {
    await this.assertMemberExists(memberId);

    if (body.email) {
      const email = body.email.trim().toLowerCase();
      const existing = await this.prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });
      if (existing && existing.id !== memberId) {
        throw new ConflictException('Email already exists');
      }
    }

    return this.prisma.user.update({
      where: { id: memberId },
      data: {
        ...(body.name ? { name: body.name.trim() } : {}),
        ...(body.email ? { email: body.email.trim().toLowerCase() } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
      },
    });
  }

  async updateStatus(
    memberId: number,
    body: UpdateMemberStatusDto,
  ): Promise<MemberResponse> {
    await this.assertMemberExists(memberId);

    return this.prisma.user.update({
      where: { id: memberId },
      data: { status: body.status },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
      },
    });
  }

  private async assertMemberExists(memberId: number): Promise<void> {
    const member = await this.prisma.user.findFirst({
      where: { id: memberId, role: Role.member },
      select: { id: true },
    });
    if (!member) {
      throw new NotFoundException('Member not found');
    }
  }
}
