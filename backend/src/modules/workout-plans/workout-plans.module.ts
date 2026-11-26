import { Module } from '@nestjs/common';
import { IdentityModule } from '../../shared/identity/identity.module.js';
import { WorkoutPlanController } from './workout-plans.controller.js';
import { WorkoutPlanService } from './workout-plans.service.js';

/** RF08–RF12: criação e consulta do plano de treino do membro. */
@Module({
  imports: [IdentityModule],
  controllers: [WorkoutPlanController],
  providers: [WorkoutPlanService],
})
export class WorkoutPlansModule {}
