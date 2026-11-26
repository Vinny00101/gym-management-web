import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty } from 'class-validator';
import { UserStatus } from '../../../generated/prisma/enums.js';

export class UpdateMemberStatusDto {
  @ApiProperty({
    enum: [UserStatus.active, UserStatus.inactive, UserStatus.suspended],
  })
  @IsNotEmpty()
  @IsIn([UserStatus.active, UserStatus.inactive, UserStatus.suspended])
  status!: UserStatus;
}
