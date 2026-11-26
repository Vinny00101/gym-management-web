import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { Role } from "../generated/prisma/enums.js";
import { Roles } from "../shared/identity/decorators/roles.decorator.js";
import { ApiCreatedResponse, ApiTags } from "@nestjs/swagger";
import { CreateWorkoutPlanDto } from "../common/dto/create-workout-plan.dto.js";
import { WorkoutPlanService } from "../services/workout-plans.service.js";
import type { AuthenticatedUser } from "../shared/identity/auth.types.js";
import { CurrentUser } from "../shared/identity/decorators/current-user.decorator.js";


@ApiTags("workout-plans")
@Controller("workout-plans")
export class WorkoutPlanController{
    // service WorkoutPlans no construtor
    constructor(
        private readonly workoutPlanService: WorkoutPlanService
    ) {}

    @Post()
    @HttpCode(HttpStatus.CREATED)
    @Roles(Role.trainer)
    @ApiCreatedResponse({description: "Plano de treino criado."})
    create(
        @CurrentUser() user: AuthenticatedUser,
        @Body() body: CreateWorkoutPlanDto
    ){
        return this.workoutPlanService.create(user, body);
    }
}