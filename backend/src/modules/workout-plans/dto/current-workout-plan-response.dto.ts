import { ApiProperty } from '@nestjs/swagger';
import { DivisionType } from '../../../generated/prisma/enums.js';

class CurrentWorkoutExerciseResponseDto {
  @ApiProperty({ example: 100 })
  id: number;

  @ApiProperty({ example: 'Supino' })
  name: string;

  @ApiProperty({ example: 4 })
  sets: number;

  @ApiProperty({ example: 10 })
  repetitions: number;
}

class CurrentWorkoutDivisionResponseDto {
  @ApiProperty({ example: 10 })
  id: number;

  @ApiProperty({ example: 'Peito e tríceps' })
  name: string;

  @ApiProperty({ enum: DivisionType, example: DivisionType.muscleGroup })
  type: DivisionType;

  @ApiProperty({ type: [CurrentWorkoutExerciseResponseDto] })
  exercises: CurrentWorkoutExerciseResponseDto[];
}

export class CurrentWorkoutPlanResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Treino A' })
  name: string;

  @ApiProperty({ example: 'Hipertrofia' })
  objective: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    example: '2026-11-26T10:00:00.000Z',
  })
  assignedAt: Date | null;

  @ApiProperty({ type: [CurrentWorkoutDivisionResponseDto] })
  divisions: CurrentWorkoutDivisionResponseDto[];
}
