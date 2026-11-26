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
  @ApiCreatedResponse({ description: 'Plano de treino criado.' })
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
  @ApiOkResponse({ description: 'Plano atribuído ao membro.' })
  @ApiBadRequestResponse({ description: 'Dados da atribuição inválidos.' })
  @ApiForbiddenResponse({ description: 'Acesso negado ao plano ou membro.' })
  @ApiNotFoundResponse({ description: 'Plano ou membro não encontrado.' })
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
  @ApiOkResponse({ description: 'Plano de treino atualizado.' })
  @ApiBadRequestResponse({ description: 'Dados do plano inválidos.' })
  @ApiForbiddenResponse({ description: 'Acesso negado ao plano.' })
  @ApiNotFoundResponse({
    description: 'Plano, divisão ou exercício não encontrado.',
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
  @ApiCreatedResponse({ description: 'Divisão criada no plano de treino.' })
  @ApiBadRequestResponse({ description: 'Dados da divisão inválidos.' })
  @ApiForbiddenResponse({ description: 'Acesso negado ao plano.' })
  @ApiNotFoundResponse({ description: 'Plano não encontrado.' })
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
  @ApiCreatedResponse({ description: 'Exercício criado na divisão.' })
  @ApiBadRequestResponse({ description: 'Dados do exercício inválidos.' })
  @ApiForbiddenResponse({ description: 'Acesso negado ao plano.' })
  @ApiNotFoundResponse({ description: 'Plano ou divisão não encontrado.' })
  addExercise(
    @CurrentUser() user: AuthenticatedUser,
    @Param('planId', ParseIntPipe) planId: number,
    @Param('divisionId', ParseIntPipe) divisionId: number,
    @Body() body: CreateExerciseDto,
  ) {
    return this.workoutPlanService.addExercise(user, planId, divisionId, body);
  }
}
