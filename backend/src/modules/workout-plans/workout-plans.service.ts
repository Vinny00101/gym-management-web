import {
  BadRequestException,
  ForbiddenException,
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
import { AssignPlanDto } from './dto/assign-plan.dto.js';
import { UpdateWorkoutPlanDto } from './dto/update-workout-plan.dto.js';

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

  async assign(
    user: AuthenticatedUser,
    planId: number,
    body: AssignPlanDto,
  ): Promise<{ planId: number; memberId: number; assignedAt: Date }> {
    if (!Number.isInteger(body?.memberId) || body.memberId <= 0) {
      throw new BadRequestException('memberId deve ser um inteiro positivo');
    }

    return this.prisma.$transaction(async (tx) => {
      const plan = await tx.workoutPlan.findUnique({
        where: { id: planId },
        select: { id: true, trainerId: true, memberId: true },
      });

      if (!plan) {
        throw new NotFoundException('Plano de treino não encontrado');
      }

      if (plan.trainerId !== user.id || plan.memberId !== body.memberId) {
        throw new ForbiddenException(
          'Você não pode atribuir este plano a este membro.',
        );
      }

      const member = await tx.user.findUnique({
        where: { id: body.memberId },
        select: { id: true, instructorId: true, activePlanId: true },
      });

      if (!member) {
        throw new NotFoundException('Membro não encontrado');
      }

      this.ownership.assertCanAccessMember(user, member);

      if (member.activePlanId !== plan.id) {
        await tx.user.update({
          where: { id: member.id },
          data: { activePlanId: plan.id },
        });
      }

      return {
        planId: plan.id,
        memberId: member.id,
        assignedAt: new Date(),
      };
    });
  }

  async update(
    user: AuthenticatedUser,
    planId: number,
    body: UpdateWorkoutPlanDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const plan = await tx.workoutPlan.findUnique({
        where: { id: planId },
        include: { divisions: { include: { exercises: true } } },
      });

      if (!plan) {
        throw new NotFoundException('Plano de treino não encontrado');
      }

      if (plan.trainerId !== user.id) {
        throw new ForbiddenException(
          'Você não pode editar um plano de outro instrutor.',
        );
      }

      const errors: string[] = [];
      if (body.name !== undefined && body.name.trim().length === 0) {
        errors.push('name não pode ser vazio');
      }
      if (
        body.divisions !== undefined &&
        (!Array.isArray(body.divisions) || body.divisions.length === 0)
      ) {
        errors.push('divisions deve conter pelo menos uma divisão');
      }

      const existingDivisions = new Map(
        plan.divisions.map((division) => [division.id, division]),
      );
      const seenDivisionIds = new Set<number>();
      const divisions = Array.isArray(body.divisions) ? body.divisions : [];

      for (const [index, division] of divisions.entries()) {
        if (typeof division.name !== 'string' || division.name.trim() === '') {
          errors.push(`divisions[${index}].name não pode ser vazio`);
        }
        if (!Object.values(DivisionType).includes(division.type)) {
          errors.push(`divisions[${index}].type inválido`);
        }
        if (
          division.order !== undefined &&
          (!Number.isInteger(division.order) || division.order < 0)
        ) {
          errors.push(`divisions[${index}].order deve ser não negativo`);
        }
        if (division.id !== undefined) {
          if (!existingDivisions.has(division.id)) {
            throw new NotFoundException(
              'Divisão não encontrada neste plano de treino',
            );
          }
          if (seenDivisionIds.has(division.id)) {
            errors.push(`divisions[${index}].id duplicado`);
          }
          seenDivisionIds.add(division.id);
        }

        const existingDivision =
          division.id === undefined
            ? undefined
            : existingDivisions.get(division.id);
        const existingExercises = new Map(
          (existingDivision?.exercises ?? []).map((exercise) => [
            exercise.id,
            exercise,
          ]),
        );
        const seenExerciseIds = new Set<number>();

        for (const [exerciseIndex, exercise] of (
          division.exercises ?? []
        ).entries()) {
          if (
            typeof exercise.name !== 'string' ||
            exercise.name.trim() === ''
          ) {
            errors.push(
              `divisions[${index}].exercises[${exerciseIndex}].name não pode ser vazio`,
            );
          }
          if (!Number.isInteger(exercise.sets) || exercise.sets < 1) {
            errors.push(
              `divisions[${index}].exercises[${exerciseIndex}].sets deve ser maior que zero`,
            );
          }
          if (
            !Number.isInteger(exercise.repetitions) ||
            exercise.repetitions < 1
          ) {
            errors.push(
              `divisions[${index}].exercises[${exerciseIndex}].repetitions deve ser maior que zero`,
            );
          }
          if (
            exercise.order !== undefined &&
            (!Number.isInteger(exercise.order) || exercise.order < 0)
          ) {
            errors.push(
              `divisions[${index}].exercises[${exerciseIndex}].order deve ser não negativo`,
            );
          }
          if (exercise.id !== undefined) {
            if (!existingExercises.has(exercise.id)) {
              throw new NotFoundException(
                'Exercício não encontrado nesta divisão do plano',
              );
            }
            if (seenExerciseIds.has(exercise.id)) {
              errors.push(
                `divisions[${index}].exercises[${exerciseIndex}].id duplicado`,
              );
            }
            seenExerciseIds.add(exercise.id);
          }
        }
      }

      if (errors.length > 0) {
        throw new BadRequestException(errors);
      }

      if (body.name !== undefined || body.objective !== undefined) {
        await tx.workoutPlan.update({
          where: { id: planId },
          data: {
            ...(body.name !== undefined ? { name: body.name.trim() } : {}),
            ...(body.objective !== undefined
              ? { objective: body.objective.trim() }
              : {}),
          },
        });
      }

      if (body.divisions !== undefined) {
        const retainedDivisionIds = body.divisions
          .map((division) => division.id)
          .filter((id): id is number => id !== undefined);
        await tx.workoutDivision.deleteMany({
          where: {
            planId,
            ...(retainedDivisionIds.length > 0
              ? { id: { notIn: retainedDivisionIds } }
              : {}),
          },
        });

        for (const [index, division] of body.divisions.entries()) {
          const savedDivision =
            division.id === undefined
              ? await tx.workoutDivision.create({
                  data: {
                    planId,
                    name: division.name.trim(),
                    type: division.type,
                    order: division.order ?? index + 1,
                  },
                })
              : await tx.workoutDivision.update({
                  where: { id: division.id },
                  data: {
                    name: division.name.trim(),
                    type: division.type,
                    ...(division.order !== undefined
                      ? { order: division.order }
                      : {}),
                  },
                });

          if (division.exercises === undefined) {
            continue;
          }

          const retainedExerciseIds = division.exercises
            .map((exercise) => exercise.id)
            .filter((id): id is number => id !== undefined);
          await tx.exercise.deleteMany({
            where: {
              divisionId: savedDivision.id,
              ...(retainedExerciseIds.length > 0
                ? { id: { notIn: retainedExerciseIds } }
                : {}),
            },
          });

          for (const [
            exerciseIndex,
            exercise,
          ] of division.exercises.entries()) {
            const data = {
              name: exercise.name.trim(),
              sets: exercise.sets,
              repetitions: exercise.repetitions,
              notes: exercise.notes?.trim() || null,
              ...(exercise.order !== undefined
                ? { order: exercise.order }
                : {}),
            };
            if (exercise.id === undefined) {
              await tx.exercise.create({
                data: {
                  ...data,
                  divisionId: savedDivision.id,
                  order: exercise.order ?? exerciseIndex + 1,
                },
              });
            } else {
              await tx.exercise.update({
                where: { id: exercise.id },
                data,
              });
            }
          }
        }
      }

      const updatedPlan = await tx.workoutPlan.findUnique({
        where: { id: planId },
        include: { divisions: { include: { exercises: true } } },
      });
      if (!updatedPlan) {
        throw new NotFoundException('Plano de treino não encontrado');
      }

      return updatedPlan;
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
