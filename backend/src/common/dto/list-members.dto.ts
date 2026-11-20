import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { UserStatus } from '../../generated/prisma/enums.js';

export class ListMembersDto {
  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsIn([UserStatus.active, UserStatus.inactive, UserStatus.suspended])
  status?: UserStatus;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @Transform(({ value }) => (value === '' ? 1 : value))
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @Transform(({ value }) => (value === '' ? 20 : value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
