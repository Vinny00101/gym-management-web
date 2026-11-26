import {BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from '../infra/database/prisma.service.js';
import { CreateWorkoutPlanDto } from "../common/dto/create-workout-plan.dto.js";
import type { AuthenticatedUser } from "../auth.types.js";
import { DivisionType } from "../generated/prisma/enums.js";
import { OwnershipService } from "./ownership.service.js";


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
}


@Injectable()
export class WorkoutPlanService{
    constructor(
        private readonly prisma: PrismaService,
        private readonly ownership: OwnershipService
    ) {}

    async create(
        user: AuthenticatedUser, 
        body: CreateWorkoutPlanDto
    ): Promise<WorkoutPlanResponse>{
        const validationErrors: string[] = [];

        if (!Array.isArray(body.divisions) || body.divisions.length === 0) {
            validationErrors.push("divisions deve conter pelo menos uma divisão");
        } else {
            body.divisions.forEach((division, index) => {
                const name = division?.name;
                const type = division?.type;

                if (typeof name !== "string" || name.trim().length === 0) {
                    validationErrors.push(`divisions[${index}].name não pode ser vazio`);
                }

                if (!type || !Object.values(DivisionType).includes(type)) {
                    validationErrors.push(`divisions[${index}].type deve ser day ou muscleGroup`);
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

        if (!member){
            throw new NotFoundException("Não foi encontrado um membro");
        }

        this.ownership.assertCanAccessMember(user, member);

        return this.prisma.workoutPlan.create({
            data: {
                name: body.name.trim(),
                objective: body.objective?.trim() ?? "",
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
} 