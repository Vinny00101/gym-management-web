import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateMemberDto {
  @ApiPropertyOptional({ example: 'Ana Souza' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional({ example: 'ana.nova@academia.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;
}
