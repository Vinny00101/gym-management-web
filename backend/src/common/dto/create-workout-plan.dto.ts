import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ArrayMinSize, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { CreateDivisionPlanDto } from "./create-divisionplan.dto.js";

export class CreateWorkoutPlanDto {
    @ApiProperty({ example: "Treino A - Peitoral" })
    @IsString()
    @IsNotEmpty()
    @MaxLength(120)
    name: string;

    @ApiPropertyOptional({ example: "Hipertrofia de peitoral" })
    @IsOptional()
    @IsString()
    objective?: string;

    @ApiProperty({ example: 1 })
    @IsInt()
    @Min(1)
    memberId: number;

    @ApiProperty({ type: [CreateDivisionPlanDto] })
    @ValidateNested({ each: true })
    @Type(() => CreateDivisionPlanDto)
    @ArrayMinSize(1)
    divisions: CreateDivisionPlanDto[];
}
