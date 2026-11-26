import { ConflictException, Injectable } from '@nestjs/common';
import type { CreateStaffDto } from '../common/dto/create-staff.dto.js';
import { Role, UserStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../infra/database/prisma.service.js';
import { PasswordService } from './password.service.js';

export type StaffResponse = {
  id: number;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
};

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
  ) {}

  async create(body: CreateStaffDto): Promise<StaffResponse> {
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
        role: body.role,
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
