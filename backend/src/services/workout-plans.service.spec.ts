import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { CreateWorkoutPlanDto } from '../common/dto/create-workout-plan.dto.js';
import { DivisionType, Role } from '../generated/prisma/enums.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { OwnershipService } from './ownership.service.js';
import { WorkoutPlanService } from './workout-plans.service.js';

describe('WorkoutPlanService', () => {
  const trainer = { id: 3, role: Role.trainer };
  const member = { id: 12, name: 'Ana', instructorId: 3 };
  const otherMember = { id: 13, name: 'Bruno', instructorId: 9 };

  const prisma = {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    workoutPlan: {
      create: vi.fn(),
    },
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
    expect(data.divisions.create.map((item: { order: number }) => item.order)).toEqual([
      1,
      2,
      7,
    ]);
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
          divisions: [
            { name: 'Peitoral', type: 'invalid' as DivisionType },
          ],
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
});
