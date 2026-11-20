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
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { UpdateMemberDto } from '../common/dto/update-member.dto.js';
import type { UpdateMemberStatusDto } from '../common/dto/update-member-status.dto.js';
import { Role } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth.types.js';
import type { ListMembersDto } from '../common/dto/list-members.dto.js';
import { Role } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ConflictException, Injectable } from '@nestjs/common';
import type { CreateMemberDto } from '../common/dto/create-member.dto.js';
import { Role, UserStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PasswordService } from './password.service.js';

export type MemberResponse = {
  id: number;
  name: string;
  email: string;
  role: Role;
  status: string;
  instructor: { id: number; name: string; email: string } | null;
};

export type MemberListResponse = {
  data: MemberResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  status: UserStatus;
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
  ) {}

  async create(body: CreateMemberDto): Promise<MemberResponse> {
    const email = body.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('Email already exists');
    }

    const passwordHash = await this.passwords.hash(body.password);
    return this.prisma.user.create({
      data: {
        name: body.name.trim(),
        email,
        passwordHash,
        role: Role.member,
        status: UserStatus.active,
      },
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
        instructor: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    return member;
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
      },
    });
  }
}
