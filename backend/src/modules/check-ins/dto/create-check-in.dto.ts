import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsPositive } from 'class-validator';

export class CreateCheckInDto {
  @ApiPropertyOptional({ example: 7 })
  @IsOptional()
  @IsInt()
  @IsPositive()
  memberId?: number;
}
