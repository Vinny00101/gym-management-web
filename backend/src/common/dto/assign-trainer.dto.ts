import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive } from 'class-validator';

export class AssignTrainerDto {
  @ApiProperty({ example: 2 })
  @IsInt()
  @IsPositive()
  trainerId!: number;
}
