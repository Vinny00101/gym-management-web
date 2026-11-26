import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateExerciseDto {
  @ApiProperty({ example: 'Supino reto' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: 3 })
  @IsInt()
  @Min(1)
  sets: number;

  @ApiProperty({ example: 12 })
  @IsInt()
  @Min(1)
  repetitions: number;

  @ApiPropertyOptional({ example: 'Executar com controle' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
