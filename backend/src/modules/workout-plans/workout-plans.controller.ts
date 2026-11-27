import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Patch,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { Role } from '../../generated/prisma/enums.js';
import { Roles } from '../../shared/identity/decorators/roles.decorator.js';
import {
  ApiOperation,
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CreateWorkoutPlanDto } from './dto/create-workout-plan.dto.js';
import { WorkoutPlanService } from './workout-plans.service.js';
import type { AuthenticatedUser } from '../../shared/identity/auth.types.js';
import { CurrentUser } from '../../shared/identity/decorators/current-user.decorator.js';
import { CreateDivisionPlanDto } from './dto/create-divisionplan.dto.js';
import { CreateExerciseDto } from './dto/create-exercise.dto.js';
import { AssignPlanDto } from './dto/assign-plan.dto.js';
import { UpdateWorkoutPlanDto } from './dto/update-workout-plan.dto.js';

@ApiTags('workout-plans')
@Controller('workout-plans')
export class WorkoutPlanController {
  // service WorkoutPlans no construtor
  constructor(private readonly workoutPlanService: WorkoutPlanService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.trainer)
  @ApiOperation({
    summary: 'Criar plano de treino',
    description: 'Acesso: trainer. O membro deve estar associado ao instrutor.',
  })
  @ApiCreatedResponse({
    description: 'Plano de treino criado.',
    schema: {
      example: {
        id: 100,
        name: 'Treino A',
        objective: 'Hipertrofia',
        trainerId: 2,
        memberId: 12,
        divisions: [
          {
            id: 10,
            planId: 100,
            name: 'Segunda-feira - Peitoral',
            type: 'day',
            order: 1,
          },
        ],
      },
    },
  })
  @ApiBadRequestResponse({
    description: '400 BAD_REQUEST: dados do plano inválidos.',
  })
  @ApiForbiddenResponse({
    description: '403 FORBIDDEN: membro não associado ao instrutor.',
  })
  @ApiNotFoundResponse({
    description: '404 NOT_FOUND: membro não encontrado.',
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateWorkoutPlanDto,
  ) {
    return this.workoutPlanService.create(user, body);
  }

  @Post(':planId/assign')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.trainer)
  @ApiParam({ name: 'planId', type: Number })
  @ApiOperation({
    summary: 'Atribuir plano ao membro',
    description: 'Acesso: trainer responsável pelo membro do plano.',
  })
  @ApiOkResponse({
    description: 'Plano atribuído ao membro.',
    schema: {
      example: {
        planId: 100,
        memberId: 12,
        assignedAt: '2026-11-26T12:00:00.000Z',
      },
    },
  })
  @ApiBadRequestResponse({
    description: '400 BAD_REQUEST: memberId inválido.',
  })
  @ApiForbiddenResponse({
    description: '403 FORBIDDEN: acesso negado ao plano ou membro.',
  })
  @ApiNotFoundResponse({
    description: '404 NOT_FOUND: plano ou membro não encontrado.',
  })
  assign(
    @CurrentUser() user: AuthenticatedUser,
    @Param('planId', ParseIntPipe) planId: number,
    @Body() body: AssignPlanDto,
  ) {
    return this.workoutPlanService.assign(user, planId, body);
  }

  @Patch(':planId')
  @Roles(Role.trainer)
  @ApiParam({ name: 'planId', type: Number })
  @ApiOperation({
    summary: 'Editar plano de treino',
    description: 'Acesso: trainer que criou o plano.',
  })
  @ApiOkResponse({
    description: 'Plano de treino atualizado.',
    schema: {
      example: {
        id: 100,
        name: 'Treino A atualizado',
        objective: 'Hipertrofia',
        trainerId: 2,
        memberId: 12,
        divisions: [
          {
            id: 10,
            name: 'Peitoral',
            type: 'day',
            order: 1,
            exercises: [
              {
                id: 20,
                name: 'Supino reto',
                sets: 4,
                repetitions: 10,
                notes: null,
                order: 1,
              },
            ],
          },
        ],
      },
    },
  })
  @ApiBadRequestResponse({
    description: '400 BAD_REQUEST: dados do plano inválidos.',
  })
  @ApiForbiddenResponse({
    description: '403 FORBIDDEN: acesso negado ao plano.',
  })
  @ApiNotFoundResponse({
    description: '404 NOT_FOUND: plano, divisão ou exercício não encontrado.',
  })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('planId', ParseIntPipe) planId: number,
    @Body() body: UpdateWorkoutPlanDto,
  ) {
    return this.workoutPlanService.update(user, planId, body);
  }

  @Post(':planId/divisions')
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.trainer)
  @ApiParam({ name: 'planId', type: Number })
  @ApiOperation({
    summary: 'Adicionar divisão ao plano',
    description: 'Acesso: trainer responsável pelo membro do plano.',
  })
  @ApiCreatedResponse({
    description: 'Divisão criada no plano de treino.',
    schema: {
      example: {
        id: 10,
        planId: 100,
        name: 'Segunda-feira - Peitoral',
        type: 'day',
        order: 1,
      },
    },
  })
  @ApiBadRequestResponse({
    description: '400 BAD_REQUEST: dados da divisão inválidos.',
  })
  @ApiForbiddenResponse({
    description: '403 FORBIDDEN: acesso negado ao plano.',
  })
  @ApiNotFoundResponse({
    description: '404 NOT_FOUND: plano não encontrado.',
  })
  addDivision(
    @CurrentUser() user: AuthenticatedUser,
    @Param('planId', ParseIntPipe) planId: number,
    @Body() body: CreateDivisionPlanDto,
  ) {
    return this.workoutPlanService.addDivision(user, planId, body);
  }

  @Post(':planId/divisions/:divisionId/exercises')
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.trainer)
  @ApiParam({ name: 'planId', type: Number })
  @ApiParam({ name: 'divisionId', type: Number })
  @ApiOperation({
    summary: 'Adicionar exercício à divisão',
    description: 'Acesso: trainer responsável pelo membro do plano.',
  })
  @ApiCreatedResponse({
    description: 'Exercício criado na divisão.',
    schema: {
      example: {
        id: 20,
        divisionId: 10,
        name: 'Supino reto',
        sets: 4,
        repetitions: 10,
        notes: null,
        order: 1,
      },
    },
  })
  @ApiBadRequestResponse({
    description: '400 BAD_REQUEST: dados do exercício inválidos.',
  })
  @ApiForbiddenResponse({
    description: '403 FORBIDDEN: acesso negado ao plano.',
  })
  @ApiNotFoundResponse({
    description: '404 NOT_FOUND: plano ou divisão não encontrado.',
  })
  addExercise(
    @CurrentUser() user: AuthenticatedUser,
    @Param('planId', ParseIntPipe) planId: number,
    @Param('divisionId', ParseIntPipe) divisionId: number,
    @Body() body: CreateExerciseDto,
  ) {
    return this.workoutPlanService.addExercise(user, planId, divisionId, body);
  }
}
