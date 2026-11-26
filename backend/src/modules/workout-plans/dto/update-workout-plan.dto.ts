import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { DivisionType } from '../../../generated/prisma/enums.js';

export class UpdateExerciseDto {
  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  id?: number;

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

export class UpdateWorkoutDivisionDto {
  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  id?: number;

  @ApiProperty({ example: 'Segunda-feira - Peitoral' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiProperty({ enum: DivisionType, example: DivisionType.day })
  @IsEnum(DivisionType)
  type: DivisionType;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @ApiPropertyOptional({ type: [UpdateExerciseDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateExerciseDto)
  exercises?: UpdateExerciseDto[];
}

export class UpdateWorkoutPlanDto {
  @ApiPropertyOptional({ example: 'Treino A - Peitoral' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: 'Hipertrofia de peitoral' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  objective?: string;

  @ApiPropertyOptional({ type: [UpdateWorkoutDivisionDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpdateWorkoutDivisionDto)
  divisions?: UpdateWorkoutDivisionDto[];
}
