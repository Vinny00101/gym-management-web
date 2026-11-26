import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/database/prisma.service.js';
import { CreateWorkoutPlanDto } from './dto/create-workout-plan.dto.js';
import type { AuthenticatedUser } from '../../shared/identity/auth.types.js';
import { DivisionType } from '../../generated/prisma/enums.js';
import { OwnershipService } from '../../shared/identity/ownership.service.js';
import { CreateDivisionPlanDto } from './dto/create-divisionplan.dto.js';
import { CreateExerciseDto } from './dto/create-exercise.dto.js';

export type WorkoutPlanResponse = {
  id: number;
  name: string;
  objective: string;
  trainerId: number;
  memberId: number;
  divisions: {
    id: number;
    planId: number;
    name: string;
    type: DivisionType;
    order: number;
  }[];
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class WorkoutPlanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: OwnershipService,
  ) {}

  async create(
    user: AuthenticatedUser,
    body: CreateWorkoutPlanDto,
  ): Promise<WorkoutPlanResponse> {
    const validationErrors: string[] = [];

    if (!Array.isArray(body.divisions) || body.divisions.length === 0) {
      validationErrors.push('divisions deve conter pelo menos uma divisão');
    } else {
      body.divisions.forEach((division, index) => {
        const name = division?.name;
        const type = division?.type;

        if (typeof name !== 'string' || name.trim().length === 0) {
          validationErrors.push(`divisions[${index}].name não pode ser vazio`);
        }

        if (!type || !Object.values(DivisionType).includes(type)) {
          validationErrors.push(
            `divisions[${index}].type deve ser day ou muscleGroup`,
          );
        }
      });
    }

    if (validationErrors.length > 0) {
      throw new BadRequestException(validationErrors);
    }

    const member = await this.prisma.user.findUnique({
      where: { id: body.memberId },
      select: { id: true, name: true, instructorId: true, passwordHash: false },
    });

    if (!member) {
      throw new NotFoundException('Não foi encontrado um membro');
    }

    this.ownership.assertCanAccessMember(user, member);

    return this.prisma.workoutPlan.create({
      data: {
        name: body.name.trim(),
        objective: body.objective?.trim() ?? '',
        trainerId: user.id,
        memberId: body.memberId,
        divisions: {
          create: body.divisions.map((division, index) => ({
            name: division.name.trim(),
            type: division.type,
            order: division.order ?? index + 1,
          })),
        },
      },
      include: { divisions: true },
    });
  }

  async addDivision(
    user: AuthenticatedUser,
    planId: number,
    body: CreateDivisionPlanDto,
  ) {
    const validationErrors: string[] = [];
    if (typeof body?.name !== 'string' || body.name.trim().length === 0) {
      validationErrors.push('name não pode ser vazio');
    }
    if (!body?.type || !Object.values(DivisionType).includes(body.type)) {
      validationErrors.push('type deve ser day ou muscleGroup');
    }
    if (
      body?.order !== undefined &&
      (!Number.isInteger(body.order) || body.order < 0)
    ) {
      validationErrors.push('order deve ser um inteiro não negativo');
    }
    if (validationErrors.length > 0) {
      throw new BadRequestException(validationErrors);
    }

    const plan = await this.prisma.workoutPlan.findUnique({
      where: { id: planId },
      select: {
        id: true,
        member: { select: { id: true, instructorId: true } },
      },
    });
    if (!plan) {
      throw new NotFoundException('Plano de treino não encontrado');
    }
    this.ownership.assertCanAccessMember(user, plan.member);

    const divisionCount = await this.prisma.workoutDivision.count({
      where: { planId },
    });

    return this.prisma.workoutDivision.create({
      data: {
        planId,
        name: body.name.trim(),
        type: body.type,
        order: body.order ?? divisionCount + 1,
      },
    });
  }

  async addExercise(
    user: AuthenticatedUser,
    planId: number,
    divisionId: number,
    body: CreateExerciseDto,
  ) {
    const validationErrors: string[] = [];
    if (typeof body?.name !== 'string' || body.name.trim().length === 0) {
      validationErrors.push('name não pode ser vazio');
    }
    if (!Number.isInteger(body?.sets) || body.sets < 1) {
      validationErrors.push('sets deve ser um inteiro maior que zero');
    }
    if (!Number.isInteger(body?.repetitions) || body.repetitions < 1) {
      validationErrors.push('repetitions deve ser um inteiro maior que zero');
    }
    if (
      body?.order !== undefined &&
      (!Number.isInteger(body.order) || body.order < 0)
    ) {
      validationErrors.push('order deve ser um inteiro não negativo');
    }
    if (validationErrors.length > 0) {
      throw new BadRequestException(validationErrors);
    }

    const plan = await this.prisma.workoutPlan.findUnique({
      where: { id: planId },
      select: {
        id: true,
        member: { select: { id: true, instructorId: true } },
      },
    });
    if (!plan) {
      throw new NotFoundException('Plano de treino não encontrado');
    }
    this.ownership.assertCanAccessMember(user, plan.member);

    const division = await this.prisma.workoutDivision.findUnique({
      where: { id: divisionId },
      select: { id: true, planId: true },
    });
    if (!division || division.planId !== planId) {
      throw new NotFoundException(
        'Divisão não encontrada neste plano de treino',
      );
    }

    const exerciseCount = await this.prisma.exercise.count({
      where: { divisionId },
    });

    return this.prisma.exercise.create({
      data: {
        divisionId,
        name: body.name.trim(),
        sets: body.sets,
        repetitions: body.repetitions,
        notes: body.notes?.trim() || null,
        order: body.order ?? exerciseCount + 1,
      },
    });
  }
}
