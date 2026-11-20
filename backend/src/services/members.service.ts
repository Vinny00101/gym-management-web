import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth.types.js';
import type { ListMembersDto } from '../common/dto/list-members.dto.js';
import { Role } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

export type MemberResponse = {
  id: number;
  name: string;
  email: string;
  role: Role;
  status: string;
};

export type MemberListResponse = {
  data: MemberResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

@Injectable()
export class MembersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    currentUser: AuthenticatedUser,
    query: ListMembersDto,
  ): Promise<MemberListResponse> {
    const where = {
      role: Role.member,
      ...(query.status ? { status: query.status } : {}),
      ...(currentUser.role === Role.trainer
        ? { instructorId: currentUser.id }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { id: 'asc' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data,
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async findOne(
    currentUser: AuthenticatedUser,
    memberId: number,
  ): Promise<MemberResponse> {
    const member = await this.prisma.user.findFirst({
      where: { id: memberId, role: Role.member },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        instructorId: true,
      },
    });

    if (
      !member ||
      (currentUser.role === Role.trainer &&
        member.instructorId !== currentUser.id)
    ) {
      throw new NotFoundException('Member not found');
    }

    const { instructorId: _instructorId, ...response } = member;
    return response;
  }
}
