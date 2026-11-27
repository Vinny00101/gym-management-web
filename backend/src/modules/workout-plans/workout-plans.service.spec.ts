import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { CreateWorkoutPlanDto } from './dto/create-workout-plan.dto.js';
import type { CreateDivisionPlanDto } from './dto/create-divisionplan.dto.js';
import type { CreateExerciseDto } from './dto/create-exercise.dto.js';
import type { AssignPlanDto } from './dto/assign-plan.dto.js';
import type { UpdateWorkoutPlanDto } from './dto/update-workout-plan.dto.js';
import { DivisionType, Role } from '../../generated/prisma/enums.js';
import type { PrismaService } from '../../infra/database/prisma.service.js';
import { OwnershipService } from '../../shared/identity/ownership.service.js';
import { WorkoutPlanService } from './workout-plans.service.js';

describe('WorkoutPlanService', () => {
  const trainer = { id: 3, role: Role.trainer };
  const member = {
    id: 12,
    name: 'Ana',
    instructorId: 3,
    activePlanId: null as number | null,
    activePlanAssignedAt: null as Date | null,
  };
  const otherMember = {
    id: 13,
    name: 'Bruno',
    instructorId: 9,
    activePlanId: null as number | null,
    activePlanAssignedAt: null as Date | null,
  };

  const prisma = {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    workoutPlan: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    workoutDivision: {
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
      findUnique: vi.fn(),
    },
    exercise: {
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(async (callback: (tx: any) => unknown) =>
      callback(prisma),
    ),
  };

  const ownership = new OwnershipService();
  const assertOwnership = vi.spyOn(ownership, 'assertCanAccessMember');

  const service = new WorkoutPlanService(
    prisma as unknown as PrismaService,
    ownership,
  );

  const makeDto = (
    overrides: Partial<CreateWorkoutPlanDto> = {},
  ): CreateWorkoutPlanDto => ({
    name: '  Treino A - Peitoral  ',
    objective: '  Hipertrofia  ',
    memberId: member.id,
    divisions: [
      { name: '  Segunda - Peitoral  ', type: DivisionType.day },
      { name: 'Terça - Costas', type: DivisionType.muscleGroup, order: 2 },
    ],
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue(member);
    prisma.user.findFirst.mockResolvedValue(member);
    prisma.workoutPlan.findUnique.mockResolvedValue({
      id: 100,
      trainerId: trainer.id,
      memberId: member.id,
      member,
      divisions: [],
    });
    prisma.workoutDivision.count.mockResolvedValue(1);
    prisma.workoutDivision.findUnique.mockResolvedValue({
      id: 10,
      planId: 100,
    });
    prisma.workoutDivision.create.mockImplementation(async ({ data }: any) => ({
      id: 10,
      ...data,
    }));
    prisma.workoutDivision.update.mockImplementation(
      async ({ where, data }: any) => ({ id: where.id, planId: 100, ...data }),
    );
    prisma.workoutDivision.deleteMany.mockResolvedValue({ count: 0 });
    prisma.exercise.count.mockResolvedValue(2);
    prisma.exercise.create.mockImplementation(async ({ data }: any) => ({
      id: 20,
      ...data,
    }));
    prisma.exercise.update.mockImplementation(async ({ where, data }: any) => ({
      id: where.id,
      divisionId: 10,
      ...data,
    }));
    prisma.exercise.deleteMany.mockResolvedValue({ count: 0 });
    prisma.workoutPlan.update.mockImplementation(
      async ({ where, data }: any) => ({ id: where.id, ...data }),
    );
    prisma.workoutPlan.create.mockImplementation(async ({ data }: any) => ({
      id: 100,
      name: data.name,
      objective: data.objective,
      trainerId: data.trainerId,
      memberId: data.memberId,
      divisions: data.divisions.create.map(
        (division: Record<string, unknown>, index: number) => ({
          id: index + 1,
          planId: 100,
          ...division,
        }),
      ),
      createdAt: new Date('2026-11-26T12:00:00.000Z'),
      updatedAt: new Date('2026-11-26T12:00:00.000Z'),
    }));
  });

  it('cria o plano com as divisões e retorna o plano criado', async () => {
    const result = await service.create(trainer, makeDto());

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: member.id },
      select: { id: true, name: true, instructorId: true, passwordHash: false },
    });
    expect(assertOwnership).toHaveBeenCalledWith(trainer, member);
    expect(prisma.workoutPlan.create).toHaveBeenCalledWith({
      data: {
        name: 'Treino A - Peitoral',
        objective: 'Hipertrofia',
        trainerId: trainer.id,
        memberId: member.id,
        divisions: {
          create: [
            {
              name: 'Segunda - Peitoral',
              type: DivisionType.day,
              order: 1,
            },
            {
              name: 'Terça - Costas',
              type: DivisionType.muscleGroup,
              order: 2,
            },
          ],
        },
      },
      include: { divisions: true },
    });
    expect(result).toEqual({
      id: 100,
      name: 'Treino A - Peitoral',
      objective: 'Hipertrofia',
      trainerId: trainer.id,
      memberId: member.id,
      divisions: [
        {
          id: 1,
          planId: 100,
          name: 'Segunda - Peitoral',
          type: DivisionType.day,
          order: 1,
        },
        {
          id: 2,
          planId: 100,
          name: 'Terça - Costas',
          type: DivisionType.muscleGroup,
          order: 2,
        },
      ],
      createdAt: new Date('2026-11-26T12:00:00.000Z'),
      updatedAt: new Date('2026-11-26T12:00:00.000Z'),
    });
  });

  it('preenche objective vazio e order sequencial quando omitidos', async () => {
    await service.create(
      trainer,
      makeDto({
        objective: undefined,
        divisions: [
          { name: 'Peitoral', type: DivisionType.muscleGroup },
          { name: 'Costas', type: DivisionType.muscleGroup },
          { name: 'Pernas', type: DivisionType.muscleGroup, order: 7 },
        ],
      }),
    );

    const data = prisma.workoutPlan.create.mock.calls[0]?.[0].data;
    expect(data.objective).toBe('');
    expect(
      data.divisions.create.map((item: { order: number }) => item.order),
    ).toEqual([1, 2, 7]);
  });

  it('rejeita lista vazia de divisões antes de consultar ou escrever', async () => {
    await expect(
      service.create(trainer, makeDto({ divisions: [] })),
    ).rejects.toMatchObject({
      response: {
        message: expect.arrayContaining([
          'divisions deve conter pelo menos uma divisão',
        ]),
      },
    });
    await expect(
      service.create(trainer, makeDto({ divisions: [] })),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.workoutPlan.create).not.toHaveBeenCalled();
  });

  it('rejeita divisão com nome vazio', async () => {
    await expect(
      service.create(
        trainer,
        makeDto({
          divisions: [{ name: '   ', type: DivisionType.day }],
        }),
      ),
    ).rejects.toMatchObject({
      response: {
        message: expect.arrayContaining([
          'divisions[0].name não pode ser vazio',
        ]),
      },
    });

    expect(prisma.workoutPlan.create).not.toHaveBeenCalled();
  });

  it('rejeita divisão com tipo inválido', async () => {
    await expect(
      service.create(
        trainer,
        makeDto({
          divisions: [{ name: 'Peitoral', type: 'invalid' as DivisionType }],
        }),
      ),
    ).rejects.toMatchObject({
      response: {
        message: expect.arrayContaining([
          'divisions[0].type deve ser day ou muscleGroup',
        ]),
      },
    });

    expect(prisma.workoutPlan.create).not.toHaveBeenCalled();
  });

  it('retorna 404 quando o membro não existe', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.create(trainer, makeDto())).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(assertOwnership).not.toHaveBeenCalled();
    expect(prisma.workoutPlan.create).not.toHaveBeenCalled();
  });

  it('nega o instrutor que não é responsável pelo membro', async () => {
    prisma.user.findUnique.mockResolvedValue(otherMember);

    await expect(service.create(trainer, makeDto())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(assertOwnership).toHaveBeenCalledWith(trainer, otherMember);
    expect(prisma.workoutPlan.create).not.toHaveBeenCalled();
  });

  it('cria como rascunho, sem alterar o plano ativo do membro', async () => {
    await service.create(trainer, makeDto());

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('adiciona uma divisão ao plano existente', async () => {
    const body: CreateDivisionPlanDto = {
      name: '  Costas  ',
      type: DivisionType.muscleGroup,
    };

    const result = await service.addDivision(trainer, 100, body);

    expect(assertOwnership).toHaveBeenCalledWith(trainer, member);
    expect(prisma.workoutDivision.create).toHaveBeenCalledWith({
      data: {
        planId: 100,
        name: 'Costas',
        type: DivisionType.muscleGroup,
        order: 2,
      },
    });
    expect(result.order).toBe(2);
  });

  it('adiciona exercício válido à divisão correta', async () => {
    const body: CreateExerciseDto = {
      name: '  Supino reto  ',
      sets: 3,
      repetitions: 12,
      notes: '  Controle a descida  ',
    };

    const result = await service.addExercise(trainer, 100, 10, body);

    expect(prisma.workoutDivision.findUnique).toHaveBeenCalledWith({
      where: { id: 10 },
      select: { id: true, planId: true },
    });
    expect(prisma.exercise.create).toHaveBeenCalledWith({
      data: {
        divisionId: 10,
        name: 'Supino reto',
        sets: 3,
        repetitions: 12,
        notes: 'Controle a descida',
        order: 3,
      },
    });
    expect(result.order).toBe(3);
  });

  it('rejeita séries e repetições inválidas', async () => {
    await expect(
      service.addExercise(trainer, 100, 10, {
        name: 'Supino',
        sets: 0,
        repetitions: -1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.exercise.create).not.toHaveBeenCalled();
  });

  it('rejeita divisão pertencente a outro plano', async () => {
    prisma.workoutDivision.findUnique.mockResolvedValue({
      id: 10,
      planId: 999,
    });

    await expect(
      service.addExercise(trainer, 100, 10, {
        name: 'Supino',
        sets: 3,
        repetitions: 12,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.exercise.create).not.toHaveBeenCalled();
  });

  it('nega instrutor sem posse do membro do plano', async () => {
    prisma.workoutPlan.findUnique.mockResolvedValue({
      id: 100,
      member: otherMember,
    });

    await expect(
      service.addExercise(trainer, 100, 10, {
        name: 'Supino',
        sets: 3,
        repetitions: 12,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.exercise.create).not.toHaveBeenCalled();
  });

  it('retorna 404 para plano inexistente', async () => {
    prisma.workoutPlan.findUnique.mockResolvedValue(null);

    await expect(
      service.addExercise(trainer, 999, 10, {
        name: 'Supino',
        sets: 3,
        repetitions: 12,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.workoutDivision.findUnique).not.toHaveBeenCalled();
    expect(prisma.exercise.create).not.toHaveBeenCalled();
  });

  it('atribui o plano ao membro em uma transação', async () => {
    const body: AssignPlanDto = { memberId: member.id };

    const result = await service.assign(trainer, 100, body);

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(assertOwnership).toHaveBeenCalledWith(trainer, member);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: member.id },
      data: {
        activePlanId: 100,
        activePlanAssignedAt: expect.any(Date),
      },
    });
    expect(result).toMatchObject({ planId: 100, memberId: member.id });
    expect(result.assignedAt).toBeInstanceOf(Date);
  });

  it('nega a atribuição de plano pertencente a outro instrutor', async () => {
    prisma.workoutPlan.findUnique.mockResolvedValue({
      id: 100,
      trainerId: 9,
      memberId: member.id,
    });

    await expect(
      service.assign(trainer, 100, { memberId: member.id }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('nega a atribuição quando o memberId não pertence ao plano', async () => {
    await expect(
      service.assign(trainer, 100, { memberId: otherMember.id }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('nega a atribuição quando o membro não está associado ao instrutor', async () => {
    prisma.user.findUnique.mockResolvedValue(otherMember);

    await expect(
      service.assign(trainer, 100, { memberId: member.id }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('retorna 404 quando o membro do plano não existe', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.assign(trainer, 100, { memberId: member.id }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('não escreve novamente quando o plano já está atribuído', async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...member,
      activePlanId: 100,
      activePlanAssignedAt: new Date('2026-11-26T12:00:00.000Z'),
    });

    const result = await service.assign(trainer, 100, { memberId: member.id });

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(result.assignedAt).toEqual(new Date('2026-11-26T12:00:00.000Z'));
  });

  it('retorna o treino ativo ordenado, sem expor dados do membro', async () => {
    const assignedAt = new Date('2026-11-26T12:00:00.000Z');
    prisma.user.findFirst.mockResolvedValue({
      ...member,
      activePlanId: 100,
      activePlanAssignedAt: assignedAt,
    });
    prisma.workoutPlan.findUnique.mockResolvedValue({
      id: 100,
      name: 'Treino A',
      objective: 'Hipertrofia',
      trainerId: trainer.id,
      memberId: member.id,
      divisions: [
        {
          id: 10,
          name: 'Peito',
          type: DivisionType.muscleGroup,
          order: 1,
          exercises: [
            {
              id: 20,
              name: 'Supino',
              sets: 4,
              repetitions: 10,
              order: 1,
            },
          ],
        },
      ],
    });

    const result = await service.findCurrent(
      { id: member.id, role: Role.member },
      member.id,
    );

    expect(result).toEqual({
      id: 100,
      name: 'Treino A',
      objective: 'Hipertrofia',
      assignedAt,
      divisions: [
        {
          id: 10,
          name: 'Peito',
          type: DivisionType.muscleGroup,
          exercises: [{ id: 20, name: 'Supino', sets: 4, repetitions: 10 }],
        },
      ],
    });
    expect(prisma.workoutPlan.findUnique).toHaveBeenCalledWith({
      where: { id: 100 },
      include: {
        divisions: {
          orderBy: { order: 'asc' },
          include: { exercises: { orderBy: { order: 'asc' } } },
        },
      },
    });
  });

  it('nega consulta por membro sem posse antes de buscar o plano', async () => {
    prisma.user.findFirst.mockResolvedValue(otherMember);

    await expect(
      service.findCurrent(trainer, otherMember.id),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.workoutPlan.findUnique).not.toHaveBeenCalled();
  });

  it('retorna 404 para membro inexistente ou sem plano atual', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(
      service.findCurrent(trainer, member.id),
    ).rejects.toBeInstanceOf(NotFoundException);

    prisma.user.findFirst.mockResolvedValue(member);
    await expect(service.findCurrent(trainer, member.id)).rejects.toThrow(
      'Nenhum plano de treino ativo',
    );

    expect(prisma.workoutPlan.findUnique).not.toHaveBeenCalled();
  });

  it('retorna 404 para plano inexistente', async () => {
    prisma.workoutPlan.findUnique.mockResolvedValue(null);

    await expect(
      service.assign(trainer, 999, { memberId: member.id }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rejeita memberId que não seja inteiro positivo', async () => {
    await expect(
      service.assign(trainer, 100, { memberId: 0 }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('atualiza plano, divisão e exercício preservando os IDs e o plano ativo', async () => {
    const planWithExercises = {
      id: 100,
      trainerId: trainer.id,
      memberId: member.id,
      name: 'Treino antigo',
      objective: 'Objetivo antigo',
      divisions: [
        {
          id: 10,
          planId: 100,
          name: 'Peitoral',
          type: DivisionType.day,
          order: 1,
          exercises: [
            {
              id: 20,
              divisionId: 10,
              name: 'Supino',
              sets: 3,
              repetitions: 10,
              notes: null,
              order: 1,
            },
          ],
        },
      ],
    };
    prisma.workoutPlan.findUnique.mockResolvedValue(planWithExercises);
    const body: UpdateWorkoutPlanDto = {
      name: '  Treino atualizado  ',
      objective: '  Força  ',
      divisions: [
        {
          id: 10,
          name: 'Peitoral atualizado',
          type: DivisionType.day,
          exercises: [
            {
              id: 20,
              name: 'Supino inclinado',
              sets: 4,
              repetitions: 8,
            },
          ],
        },
      ],
    };

    await service.update(trainer, 100, body);

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(prisma.workoutPlan.update).toHaveBeenCalledWith({
      where: { id: 100 },
      data: { name: 'Treino atualizado', objective: 'Força' },
    });
    expect(prisma.workoutDivision.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: {
        name: 'Peitoral atualizado',
        type: DivisionType.day,
      },
    });
    expect(prisma.exercise.update).toHaveBeenCalledWith({
      where: { id: 20 },
      data: {
        name: 'Supino inclinado',
        sets: 4,
        repetitions: 8,
        notes: null,
      },
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('remove divisões omitidas e cria novas quando a lista é enviada', async () => {
    prisma.workoutPlan.findUnique.mockResolvedValue({
      id: 100,
      trainerId: trainer.id,
      memberId: member.id,
      divisions: [
        {
          id: 10,
          exercises: [],
        },
      ],
    });

    await service.update(trainer, 100, {
      divisions: [
        {
          name: 'Costas',
          type: DivisionType.muscleGroup,
          exercises: [],
        },
      ],
    });

    expect(prisma.workoutDivision.deleteMany).toHaveBeenCalledWith({
      where: { planId: 100 },
    });
    expect(prisma.workoutDivision.create).toHaveBeenCalledWith({
      data: {
        planId: 100,
        name: 'Costas',
        type: DivisionType.muscleGroup,
        order: 1,
      },
    });
  });

  it('rejeita lista vazia de divisões antes de escrever', async () => {
    await expect(
      service.update(trainer, 100, { divisions: [] }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.workoutPlan.update).not.toHaveBeenCalled();
    expect(prisma.workoutDivision.deleteMany).not.toHaveBeenCalled();
  });

  it('rejeita exercício com séries ou repetições inválidas sem escrever', async () => {
    prisma.workoutPlan.findUnique.mockResolvedValue({
      id: 100,
      trainerId: trainer.id,
      memberId: member.id,
      divisions: [{ id: 10, exercises: [] }],
    });

    await expect(
      service.update(trainer, 100, {
        divisions: [
          {
            id: 10,
            name: 'Peitoral',
            type: DivisionType.day,
            exercises: [{ name: 'Supino', sets: 0, repetitions: 10 }],
          },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.workoutDivision.deleteMany).not.toHaveBeenCalled();
    expect(prisma.exercise.create).not.toHaveBeenCalled();
  });

  it('retorna 404 quando a divisão informada não pertence ao plano', async () => {
    await expect(
      service.update(trainer, 100, {
        divisions: [
          {
            id: 999,
            name: 'Peitoral',
            type: DivisionType.day,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.workoutDivision.deleteMany).not.toHaveBeenCalled();
  });

  it('retorna 403 ao editar plano de outro instrutor', async () => {
    prisma.workoutPlan.findUnique.mockResolvedValue({
      id: 100,
      trainerId: 9,
      memberId: member.id,
      divisions: [],
    });

    await expect(
      service.update(trainer, 100, { name: 'Treino novo' }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.workoutPlan.update).not.toHaveBeenCalled();
  });

  it('retorna 404 para plano inexistente', async () => {
    prisma.workoutPlan.findUnique.mockResolvedValue(null);

    await expect(
      service.update(trainer, 999, { name: 'Treino novo' }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.workoutPlan.update).not.toHaveBeenCalled();
  });

  it('mantém a edição na transação caso uma escrita falhe', async () => {
    prisma.workoutPlan.update.mockRejectedValue(new Error('falha de escrita'));

    await expect(
      service.update(trainer, 100, { name: 'Treino novo' }),
    ).rejects.toThrow('falha de escrita');

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(prisma.workoutDivision.deleteMany).not.toHaveBeenCalled();
  });
});
