import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserStatus } from '../../generated/prisma/enums.js';

export class CreateMemberDto {
  @ApiProperty({ example: 'Ana Souza' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'ana@academia.com' })
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: 'Senha@123' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiProperty({
    enum: [UserStatus.active, UserStatus.inactive, UserStatus.suspended],
    required: false,
  })
  @IsOptional()
  @IsIn([UserStatus.active, UserStatus.inactive, UserStatus.suspended])
  status?: UserStatus;
}
