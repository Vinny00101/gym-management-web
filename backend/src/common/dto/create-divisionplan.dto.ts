import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from "class-validator";
import { DivisionType } from "../../generated/prisma/enums.js";

export class CreateDivisionPlanDto {
    @ApiProperty({ example: "Segunda-feira - Peitoral" })
    @IsString()
    @IsNotEmpty()
    @MaxLength(120)
    name: string;

    @ApiProperty({ enum: DivisionType, example: DivisionType.day })
    @IsEnum(DivisionType)
    type: DivisionType;

    @ApiPropertyOptional({ example: 1 })
    @IsOptional()
    @IsInt()
    @Min(1)
    order?: number;
}
