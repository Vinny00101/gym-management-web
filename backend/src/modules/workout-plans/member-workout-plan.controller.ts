import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import {
  ApiOperation,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '../../generated/prisma/enums.js';
import type { AuthenticatedUser } from '../../shared/identity/auth.types.js';
import { CurrentUser } from '../../shared/identity/decorators/current-user.decorator.js';
import { Roles } from '../../shared/identity/decorators/roles.decorator.js';
import { CurrentWorkoutPlanResponseDto } from './dto/current-workout-plan-response.dto.js';
import { WorkoutPlanService } from './workout-plans.service.js';

@ApiTags('members')
@Controller('members')
export class MemberWorkoutPlanController {
  constructor(private readonly workoutPlanService: WorkoutPlanService) {}

  @Get(':memberId/workout-plan')
  @Roles(Role.member, Role.trainer)
  @ApiParam({ name: 'memberId', type: Number })
  @ApiOperation({
    summary: 'Consultar treino atual do membro',
    description: 'Acesso: o próprio member ou seu trainer responsável.',
  })
  @ApiOkResponse({
    description: 'Plano de treino atual do membro.',
    type: CurrentWorkoutPlanResponseDto,
  })
  @ApiForbiddenResponse({
    description: '403 FORBIDDEN: acesso negado ao membro.',
  })
  @ApiNotFoundResponse({
    description: '404 NOT_FOUND: membro inexistente ou sem plano atual.',
  })
  findCurrent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('memberId', ParseIntPipe) memberId: number,
  ) {
    return this.workoutPlanService.findCurrent(user, memberId);
  }
}
