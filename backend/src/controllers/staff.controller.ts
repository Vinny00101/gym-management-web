import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CreateStaffDto } from '../common/dto/create-staff.dto.js';
import { Role } from '../generated/prisma/enums.js';
import { StaffResponse, StaffService } from '../services/staff.service.js';

@ApiTags('staff')
@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.admin)
  @ApiCreatedResponse({ description: 'Usuário administrativo criado.' })
  create(@Body() body: CreateStaffDto): Promise<StaffResponse> {
    return this.staffService.create(body);
  }
}
