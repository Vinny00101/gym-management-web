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
  status: UserStatus;
};

@Injectable()
export class MembersService {
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
      },
    });
  }
}
